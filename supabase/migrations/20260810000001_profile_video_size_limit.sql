-- Enforce 100MB max upload size for profile videos (matches client validation).
UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE name = 'profile-videos';
