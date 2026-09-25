-- Persistent pool pass + one-interest-per-person guards + pool filtering.

CREATE OR REPLACE FUNCTION public.matchmaker_viewer_hides_pool_member(
  p_viewer_id UUID,
  p_member_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matchmaker_interests mi
    WHERE mi.from_user_id = p_viewer_id
      AND mi.to_user_id = p_member_id
      AND mi.status IN ('pending', 'passed', 'accepted')
  );
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_get_member_interaction(p_member_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_status TEXT;
  v_has_exclusion BOOLEAN;
  v_has_active_connection BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_member_user_id = v_user THEN
    RETURN jsonb_build_object('viewer_state', 'self', 'can_express', false, 'can_pass', false);
  END IF;

  SELECT status INTO v_status
  FROM public.matchmaker_interests
  WHERE from_user_id = v_user
    AND to_user_id = p_member_user_id;

  v_has_exclusion := public.matchmaker_interest_pair_excluded(v_user, p_member_user_id);

  v_has_active_connection := EXISTS (
    SELECT 1
    FROM public.matchmaker_connections mc
    WHERE mc.status IN ('active', 'paused')
      AND (
        (mc.user_a_id = v_user AND mc.user_b_id = p_member_user_id)
        OR (mc.user_a_id = p_member_user_id AND mc.user_b_id = v_user)
      )
  );

  IF v_has_active_connection OR v_has_exclusion OR v_status = 'accepted' THEN
    RETURN jsonb_build_object(
      'viewer_state', 'matched',
      'interest_status', COALESCE(v_status, 'accepted'),
      'can_express', false,
      'can_pass', false
    );
  END IF;

  IF v_status = 'pending' THEN
    RETURN jsonb_build_object(
      'viewer_state', 'interest_sent',
      'interest_status', v_status,
      'can_express', false,
      'can_pass', true
    );
  END IF;

  IF v_status = 'passed' THEN
    RETURN jsonb_build_object(
      'viewer_state', 'passed',
      'interest_status', v_status,
      'can_express', false,
      'can_pass', false
    );
  END IF;

  IF v_status IS NOT NULL THEN
    RETURN jsonb_build_object(
      'viewer_state', 'interest_sent',
      'interest_status', v_status,
      'can_express', false,
      'can_pass', false
    );
  END IF;

  RETURN jsonb_build_object(
    'viewer_state', 'none',
    'interest_status', NULL,
    'can_express', true,
    'can_pass', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_pass_pool_profile(p_to_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from UUID := auth.uid();
BEGIN
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_to_user_id = v_from THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;

  INSERT INTO public.matchmaker_interests (from_user_id, to_user_id, status, surfaced_at)
  VALUES (v_from, p_to_user_id, 'passed', NULL)
  ON CONFLICT (from_user_id, to_user_id) DO UPDATE
  SET
    status = 'passed',
    expressed_at = NOW(),
    expires_at = NOW() + INTERVAL '30 days',
    surfaced_at = NULL,
    opened_at = NULL;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_express_interest(p_to_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from UUID := auth.uid();
  v_mutual_interest public.matchmaker_interests%ROWTYPE;
  v_new_connection_id UUID;
  v_user_a UUID;
  v_user_b UUID;
  v_target_connected BOOLEAN;
  v_sender_name TEXT;
  v_existing_status TEXT;
  v_should_notify BOOLEAN;
BEGIN
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_to_user_id = v_from THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;

  IF public.matchmaker_user_has_active_connection(v_from) THEN
    RAISE EXCEPTION 'sender_has_active_connection';
  END IF;

  PERFORM public.matchmaker_expire_stale_interests();

  SELECT status INTO v_existing_status
  FROM public.matchmaker_interests
  WHERE from_user_id = v_from AND to_user_id = p_to_user_id;

  IF v_existing_status IS NOT NULL THEN
    RETURN jsonb_build_object(
      'matched', false,
      'already_sent', true,
      'interest_status', v_existing_status
    );
  END IF;

  SELECT * INTO v_mutual_interest
  FROM public.matchmaker_interests
  WHERE from_user_id = p_to_user_id
    AND to_user_id = v_from
    AND status = 'pending'
    AND expires_at > NOW()
    AND surfaced_at IS NOT NULL;

  IF v_mutual_interest.id IS NOT NULL THEN
    v_user_a := LEAST(v_from, p_to_user_id);
    v_user_b := GREATEST(v_from, p_to_user_id);

    INSERT INTO public.matchmaker_connections (user_a_id, user_b_id, status)
    VALUES (v_user_a, v_user_b, 'active')
    RETURNING id INTO v_new_connection_id;

    UPDATE public.matchmaker_interests SET status = 'accepted'
    WHERE (from_user_id = v_from AND to_user_id = p_to_user_id)
       OR (from_user_id = p_to_user_id AND to_user_id = v_from);

    INSERT INTO public.matchmaker_exclusions (user_a_id, user_b_id)
    VALUES (v_user_a, v_user_b)
    ON CONFLICT DO NOTHING;

    PERFORM public.matchmaker_get_or_create_conversation(v_user_a, v_user_b, v_new_connection_id);

    PERFORM public.create_notification(
      v_from,
      'matchmaker_mutual_connection',
      'New MatchMaker connection',
      'You have a new MatchMaker connection.',
      jsonb_build_object('connection_id', v_new_connection_id, 'href', '/matchmaker/connection/' || v_new_connection_id::text),
      'high',
      'matchmaker_mutual:' || v_new_connection_id::text || ':' || v_from::text
    );

    PERFORM public.create_notification(
      p_to_user_id,
      'matchmaker_mutual_connection',
      'New MatchMaker connection',
      'You have a new MatchMaker connection.',
      jsonb_build_object('connection_id', v_new_connection_id, 'href', '/matchmaker/connection/' || v_new_connection_id::text),
      'high',
      'matchmaker_mutual:' || v_new_connection_id::text || ':' || p_to_user_id::text
    );

    RETURN jsonb_build_object('matched', true, 'connection_id', v_new_connection_id);
  END IF;

  v_target_connected := public.matchmaker_user_has_active_connection(p_to_user_id);

  INSERT INTO public.matchmaker_interests (from_user_id, to_user_id, status, surfaced_at, opened_at)
  VALUES (
    v_from,
    p_to_user_id,
    'pending',
    CASE WHEN v_target_connected THEN NULL ELSE NOW() END,
    NULL
  );

  v_should_notify := NOT v_target_connected AND NOT public.matchmaker_user_has_ever_connected(p_to_user_id);

  IF v_should_notify THEN
    SELECT COALESCE(NULLIF(btrim(display_name), ''), 'Someone') INTO v_sender_name
    FROM public.profiles WHERE user_id = v_from;

    PERFORM public.create_notification(
      p_to_user_id,
      'matchmaker_interest_received',
      'New MatchMaker interest',
      v_sender_name || ' expressed interest in you on MatchMaker.',
      jsonb_build_object('href', '/matchmaker/interests', 'from_user_id', v_from::text),
      'medium',
      'matchmaker_interest:' || v_from::text || ':' || p_to_user_id::text
    );

    BEGIN
      PERFORM net.http_post(
        url := rtrim(current_setting('app.settings.supabase_url', true), '/') || '/functions/v1/send-matchmaker-interest-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'recipientUserId', p_to_user_id::text,
          'senderUserId', v_from::text,
          'senderName', v_sender_name
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'matched', false,
    'queued', v_target_connected,
    'surfaced', NOT v_target_connected
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('matched', false, 'already_sent', true);
END;
$$;

-- Patch pool query: hide profiles the viewer already passed or expressed interest in.
CREATE OR REPLACE FUNCTION public.matchmaker_get_pool(
  p_limit INT DEFAULT 12,
  p_max_distance_km INT DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'best_match'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_viewer public.profiles%ROWTYPE;
  v_viewer_pool_gender TEXT;
  v_target_gender TEXT;
  v_dealbreakers JSONB;
  v_viewer_faith TEXT;
  v_viewer_family_goals TEXT;
  v_max_distance_km INT;
  v_age_min INT;
  v_age_max INT;
  v_has_location_dealbreaker BOOLEAN;
  v_has_any_dealbreaker BOOLEAN;
  v_profiles JSONB;
  v_has_without_dealbreakers BOOLEAN;
  v_has_without_location BOOLEAN;
  v_sort_by TEXT := COALESCE(NULLIF(trim(p_sort_by), ''), 'best_match');
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF v_sort_by NOT IN ('best_match', 'recently_joined') THEN
    v_sort_by := 'best_match';
  END IF;

  SELECT * INTO v_viewer FROM public.profiles WHERE user_id = v_user;

  v_viewer_pool_gender := public.matchmaker_pool_gender(v_viewer.gender);

  IF v_viewer_pool_gender IS NULL THEN
    RETURN jsonb_build_object('profiles', '[]'::jsonb, 'empty_reason', 'gender_not_set');
  END IF;

  IF v_viewer_pool_gender = 'female' THEN
    v_target_gender := 'male';
  ELSE
    v_target_gender := 'female';
  END IF;

  SELECT mv.dealbreakers, mv.faith, mv.family_goals
  INTO v_dealbreakers, v_viewer_faith, v_viewer_family_goals
  FROM public.matchmaker_values mv
  WHERE mv.user_id = v_user;

  v_dealbreakers := COALESCE(v_dealbreakers, '{}'::jsonb);
  v_max_distance_km := NULLIF((v_dealbreakers->>'max_distance_km')::INT, 0);
  v_age_min := NULLIF((v_dealbreakers->>'age_min')::INT, 0);
  v_age_max := NULLIF((v_dealbreakers->>'age_max')::INT, 0);
  v_has_location_dealbreaker := v_max_distance_km IS NOT NULL;
  v_has_any_dealbreaker :=
    COALESCE((v_dealbreakers->>'faith_alignment')::BOOLEAN, FALSE)
    OR COALESCE((v_dealbreakers->>'family_goals_alignment')::BOOLEAN, FALSE)
    OR v_has_location_dealbreaker
    OR v_age_min IS NOT NULL
    OR v_age_max IS NOT NULL;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_profiles
  FROM (
    SELECT
      p.user_id,
      p.display_name,
      p.birth_date,
      p.location_label,
      p.photo_urls,
      p.primary_photo_url,
      p.avatar_url,
      p.preferences,
      p.communication_style,
      p.latitude,
      p.longitude,
      p.verified_badge,
      public.matchmaker_haversine_km(v_viewer.latitude, v_viewer.longitude, p.latitude, p.longitude) AS distance_km
    FROM public.profiles p
    INNER JOIN public.users u ON u.id = p.user_id
    INNER JOIN public.matchmaker_intents mi_sort ON mi_sort.user_id = p.user_id AND mi_sort.is_active
    LEFT JOIN public.matchmaker_values cv ON cv.user_id = p.user_id
    WHERE p.user_id <> v_user
      AND public.matchmaker_pool_gender(p.gender) = v_target_gender
      AND u.verification_status = 'verified'
      AND public.matchmaker_user_has_gold_access(p.user_id)
      AND public.matchmaker_profile_is_pool_eligible(p)
      AND EXISTS (SELECT 1 FROM public.matchmaker_values mv WHERE mv.user_id = p.user_id)
      AND NOT public.matchmaker_viewer_hides_pool_member(v_user, p.user_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.matchmaker_exclusions me
        WHERE (me.user_a_id = v_user AND me.user_b_id = p.user_id)
           OR (me.user_a_id = p.user_id AND me.user_b_id = v_user)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.matchmaker_connections mc
        WHERE mc.status IN ('active', 'paused')
          AND (mc.user_a_id = p.user_id OR mc.user_b_id = p.user_id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.matchmaker_cooldowns cd
        WHERE cd.user_id = p.user_id AND cd.cooldown_until > NOW()
      )
      AND (
        NOT COALESCE((v_dealbreakers->>'faith_alignment')::BOOLEAN, FALSE)
        OR (
          v_viewer_faith IS NOT NULL
          AND cv.faith IS NOT DISTINCT FROM v_viewer_faith
        )
      )
      AND (
        NOT COALESCE((v_dealbreakers->>'family_goals_alignment')::BOOLEAN, FALSE)
        OR (
          v_viewer_family_goals IS NOT NULL
          AND cv.family_goals = v_viewer_family_goals
        )
      )
      AND (
        NOT v_has_location_dealbreaker
        OR (
          p.latitude IS NOT NULL
          AND p.longitude IS NOT NULL
          AND v_viewer.latitude IS NOT NULL
          AND v_viewer.longitude IS NOT NULL
          AND public.matchmaker_haversine_km(v_viewer.latitude, v_viewer.longitude, p.latitude, p.longitude)
            <= COALESCE(v_max_distance_km, 50)
        )
      )
      AND (
        (v_age_min IS NULL AND v_age_max IS NULL)
        OR (
          p.birth_date IS NOT NULL
          AND EXTRACT(YEAR FROM age(p.birth_date::date))::INT >= COALESCE(v_age_min, 18)
          AND EXTRACT(YEAR FROM age(p.birth_date::date))::INT <= COALESCE(v_age_max, 99)
        )
      )
      AND (
        p_max_distance_km IS NULL
        OR (
          p.latitude IS NOT NULL
          AND p.longitude IS NOT NULL
          AND v_viewer.latitude IS NOT NULL
          AND v_viewer.longitude IS NOT NULL
          AND public.matchmaker_haversine_km(v_viewer.latitude, v_viewer.longitude, p.latitude, p.longitude)
            <= p_max_distance_km
        )
      )
    ORDER BY
      CASE WHEN v_sort_by = 'recently_joined' THEN mi_sort.declared_at END DESC NULLS LAST,
      p.updated_at DESC NULLS LAST
    LIMIT GREATEST(1, LEAST(p_limit, 50))
  ) t;

  IF jsonb_array_length(v_profiles) > 0 THEN
    RETURN jsonb_build_object('profiles', v_profiles, 'empty_reason', NULL);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.users u ON u.id = p.user_id
    WHERE p.user_id <> v_user
      AND public.matchmaker_pool_gender(p.gender) = v_target_gender
      AND u.verification_status = 'verified'
      AND public.matchmaker_user_has_gold_access(p.user_id)
      AND public.matchmaker_profile_is_pool_eligible(p)
      AND EXISTS (SELECT 1 FROM public.matchmaker_intents mi WHERE mi.user_id = p.user_id AND mi.is_active)
      AND EXISTS (SELECT 1 FROM public.matchmaker_values mv WHERE mv.user_id = p.user_id)
      AND NOT public.matchmaker_viewer_hides_pool_member(v_user, p.user_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.matchmaker_exclusions me
        WHERE (me.user_a_id = v_user AND me.user_b_id = p.user_id)
           OR (me.user_a_id = p.user_id AND me.user_b_id = v_user)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.matchmaker_connections mc
        WHERE mc.status IN ('active', 'paused')
          AND (mc.user_a_id = p.user_id OR mc.user_b_id = p.user_id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.matchmaker_cooldowns cd
        WHERE cd.user_id = p.user_id AND cd.cooldown_until > NOW()
      )
    LIMIT 1
  ) INTO v_has_without_dealbreakers;

  IF NOT v_has_without_dealbreakers THEN
    RETURN jsonb_build_object('profiles', '[]'::jsonb, 'empty_reason', 'genuinely_empty');
  END IF;

  IF v_has_location_dealbreaker OR p_max_distance_km IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles p
      INNER JOIN public.users u ON u.id = p.user_id
      LEFT JOIN public.matchmaker_values cv ON cv.user_id = p.user_id
      WHERE p.user_id <> v_user
        AND public.matchmaker_pool_gender(p.gender) = v_target_gender
        AND u.verification_status = 'verified'
        AND public.matchmaker_user_has_gold_access(p.user_id)
        AND public.matchmaker_profile_is_pool_eligible(p)
        AND EXISTS (SELECT 1 FROM public.matchmaker_intents mi WHERE mi.user_id = p.user_id AND mi.is_active)
        AND EXISTS (SELECT 1 FROM public.matchmaker_values mv WHERE mv.user_id = p.user_id)
        AND NOT public.matchmaker_viewer_hides_pool_member(v_user, p.user_id)
        AND NOT EXISTS (
          SELECT 1 FROM public.matchmaker_exclusions me
          WHERE (me.user_a_id = v_user AND me.user_b_id = p.user_id)
             OR (me.user_a_id = p.user_id AND me.user_b_id = v_user)
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.matchmaker_connections mc
          WHERE mc.status IN ('active', 'paused')
            AND (mc.user_a_id = p.user_id OR mc.user_b_id = p.user_id)
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.matchmaker_cooldowns cd
          WHERE cd.user_id = p.user_id AND cd.cooldown_until > NOW()
        )
        AND (
          NOT COALESCE((v_dealbreakers->>'faith_alignment')::BOOLEAN, FALSE)
          OR (
            v_viewer_faith IS NOT NULL
            AND cv.faith IS NOT DISTINCT FROM v_viewer_faith
          )
        )
        AND (
          NOT COALESCE((v_dealbreakers->>'family_goals_alignment')::BOOLEAN, FALSE)
          OR (
            v_viewer_family_goals IS NOT NULL
            AND cv.family_goals = v_viewer_family_goals
          )
        )
        AND (
          (v_age_min IS NULL AND v_age_max IS NULL)
          OR (
            p.birth_date IS NOT NULL
            AND EXTRACT(YEAR FROM age(p.birth_date::date))::INT >= COALESCE(v_age_min, 18)
            AND EXTRACT(YEAR FROM age(p.birth_date::date))::INT <= COALESCE(v_age_max, 99)
          )
        )
      LIMIT 1
    ) INTO v_has_without_location;

    IF v_has_without_location THEN
      RETURN jsonb_build_object('profiles', '[]'::jsonb, 'empty_reason', 'location_narrow');
    END IF;
  END IF;

  IF v_has_any_dealbreaker THEN
    RETURN jsonb_build_object('profiles', '[]'::jsonb, 'empty_reason', 'dealbreakers_strict');
  END IF;

  RETURN jsonb_build_object('profiles', '[]'::jsonb, 'empty_reason', 'genuinely_empty');
END;
$$;

GRANT EXECUTE ON FUNCTION public.matchmaker_pass_pool_profile(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_get_member_interaction(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_viewer_hides_pool_member(UUID, UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
