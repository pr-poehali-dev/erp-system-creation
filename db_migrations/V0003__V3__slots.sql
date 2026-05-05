CREATE TABLE slots (
  id SERIAL PRIMARY KEY,
  year INT NOT NULL,
  month INT NOT NULL,
  status VARCHAR(30) DEFAULT 'free',
  deal_id INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);