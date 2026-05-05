CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  deal_id INT REFERENCES deals(id),
  client_id INT REFERENCES clients(id),
  address TEXT,
  brigade VARCHAR(100),
  start_date DATE NOT NULL,
  deadline DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'active',
  total_cost NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);