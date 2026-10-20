ALTER TABLE payouts ADD COLUMN batch_status text;

-- Legacy batch and item terminal states shared names without stored provenance.
UPDATE payouts
SET batch_status = status,
    status = CASE
      WHEN status IN ('PENDING', 'PROCESSING') THEN 'PENDING'
      ELSE 'manual_review'
    END
WHERE status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'DENIED', 'CANCELED');
