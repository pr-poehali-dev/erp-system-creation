CREATE TABLE deals (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  client_id INT REFERENCES clients(id),
  manager_id INT REFERENCES staff(id),
  realtor_id INT REFERENCES staff(id),
  source VARCHAR(80),
  stage VARCHAR(50) DEFAULT 'new',
  budget NUMERIC(14,2),
  start_date DATE,
  notes TEXT,
  slot_id INT REFERENCES slots(id),
  project_id INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);