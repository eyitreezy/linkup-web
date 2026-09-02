-- In-app notifications for new messages (deduped per recipient).

CREATE OR REPLACE FUNCTION public.notify_message_recipients()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _conv public.conversations%ROWTYPE;
  _sender_name TEXT;
  _preview TEXT;
  _recipient UUID;
  _member RECORD;
BEGIN
  IF NEW.sender_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _conv FROM public.conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(trim(display_name), ''), 'Someone')
  INTO _sender_name
  FROM public.profiles
  WHERE user_id = NEW.sender_id;

  _preview := COALESCE(
    NULLIF(trim(COALESCE(NEW.text, NEW.body, '')), ''),
    CASE WHEN NEW.media_id IS NOT NULL THEN 'Sent an attachment' ELSE 'New message' END
  );
  IF char_length(_preview) > 140 THEN
    _preview := left(_preview, 137) || '...';
  END IF;

  IF COALESCE(_conv.is_group_chat, false) THEN
    FOR _member IN
      SELECT user_id
      FROM public.group_chat_members
      WHERE conversation_id = NEW.conversation_id
        AND removed_at IS NULL
        AND user_id IS DISTINCT FROM NEW.sender_id
    LOOP
      PERFORM public.create_notification(
        _member.user_id,
        'message',
        _sender_name,
        _preview,
        jsonb_build_object(
          'chatId', NEW.conversation_id,
          'href', '/messages?c=' || NEW.conversation_id::text
        ),
        'medium',
        'message:' || NEW.id::text || ':' || _member.user_id::text
      );
    END LOOP;
  ELSE
    _recipient := CASE
      WHEN _conv.user_a = NEW.sender_id THEN _conv.user_b
      WHEN _conv.user_b = NEW.sender_id THEN _conv.user_a
      ELSE NULL
    END;

    IF _recipient IS NOT NULL THEN
      PERFORM public.create_notification(
        _recipient,
        'message',
        _sender_name,
        _preview,
        jsonb_build_object(
          'chatId', NEW.conversation_id,
          'href', '/messages?c=' || NEW.conversation_id::text
        ),
        'medium',
        'message:' || NEW.id::text || ':' || _recipient::text
      );
    END IF;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := rtrim(current_setting('app.settings.supabase_url', true), '/') || '/functions/v1/send-message-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('messageId', NEW.id::text)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_notify_recipients ON public.messages;
CREATE TRIGGER messages_notify_recipients
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_message_recipients();

NOTIFY pgrst, 'reload schema';
