ALTER TABLE delivery_shifts DROP CONSTRAINT delivery_shifts_platform_check;
ALTER TABLE delivery_shifts ADD CONSTRAINT delivery_shifts_platform_check
CHECK (platform IN ('DoorDash','Uber','Uber Eats','Lyft','Instacart','Grubhub','TaskRabbit','Rover','Thumbtack','Other'));
