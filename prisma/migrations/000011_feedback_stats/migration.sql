ALTER TABLE feedback DROP CONSTRAINT feedback_app_check;
ALTER TABLE feedback ADD CONSTRAINT feedback_app_check
  CHECK (app IN ('first', 'spotlight', 'freelance', 'market', 'paypal', 'stats'));
