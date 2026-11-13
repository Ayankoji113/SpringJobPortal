-- Moderation state for a posting, replacing the is_approved boolean.
--
-- A boolean could not say "rejected, and here is why", and every read path that forgot to add
-- "AND is_approved" silently served unreviewed postings -- five of the seven job queries did.
--
-- is_active stays: it is the employer's own on/off switch and is orthogonal to moderation. A
-- posting is visible to the public only when status = 'PUBLISHED' AND is_active = true.

ALTER TABLE job_post ADD COLUMN status VARCHAR(32);

-- Nothing ever wrote is_approved = false, so in practice every row becomes PUBLISHED. The CASE is
-- there for any database where it was set by hand.
UPDATE job_post
SET status = CASE WHEN is_approved IS FALSE THEN 'PENDING_REVIEW' ELSE 'PUBLISHED' END;

ALTER TABLE job_post ALTER COLUMN status SET NOT NULL;
ALTER TABLE job_post ADD CONSTRAINT job_post_status_check
    CHECK (status IN ('PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'SUSPENDED'));

ALTER TABLE job_post DROP COLUMN is_approved;

-- Why a posting was rejected or suspended, shown to the employer.
ALTER TABLE job_post ADD COLUMN moderation_reason TEXT;
ALTER TABLE job_post ADD COLUMN reviewed_at TIMESTAMP(6);
ALTER TABLE job_post ADD COLUMN reviewed_by_id INTEGER REFERENCES users (id);

-- Every public listing filters on this pair.
CREATE INDEX idx_job_post_status_active ON job_post (status, is_active);
