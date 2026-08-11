-- Enforce 30MB max upload size for profile videos (matches client validation).
UPDATE storage.buckets
SET file_size_limit = 31457280
WHERE name = 'profile-videos';
