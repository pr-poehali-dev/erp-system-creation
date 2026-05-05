CREATE TABLE project_stages (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES projects(id),
  name VARCHAR(100) NOT NULL,
  order_num INT NOT NULL,
  duration_days INT NOT NULL,
  planned_start DATE,
  planned_end DATE,
  actual_start DATE,
  actual_end DATE,
  status VARCHAR(30) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);