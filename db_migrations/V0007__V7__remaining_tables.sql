CREATE TABLE material_requests (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  project_id INT REFERENCES projects(id),
  material VARCHAR(300) NOT NULL,
  quantity NUMERIC(12,3),
  unit VARCHAR(20),
  required_date DATE,
  priority VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(30) DEFAULT 'new',
  foreman_id INT REFERENCES staff(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  project_id INT REFERENCES projects(id),
  deal_id INT REFERENCES deals(id),
  type VARCHAR(20) NOT NULL,
  category VARCHAR(100),
  amount NUMERIC(14,2) NOT NULL,
  payment_date DATE NOT NULL,
  description TEXT,
  created_by INT REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE checklists (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  project_id INT REFERENCES projects(id),
  stage_id INT REFERENCES project_stages(id),
  inspector VARCHAR(100),
  source VARCHAR(30) DEFAULT 'web',
  status VARCHAR(20) DEFAULT 'pending',
  total_items INT DEFAULT 0,
  passed_items INT DEFAULT 0,
  telegram_msg_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE checklist_items (
  id SERIAL PRIMARY KEY,
  checklist_id INT REFERENCES checklists(id),
  item_text TEXT NOT NULL,
  result VARCHAR(20),
  photo_url TEXT,
  notes TEXT
);

CREATE TABLE foreman_tasks (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES projects(id),
  checklist_id INT REFERENCES checklists(id),
  foreman_id INT REFERENCES staff(id),
  title TEXT NOT NULL,
  description TEXT,
  photo_url TEXT,
  status VARCHAR(20) DEFAULT 'open',
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE k_company_log (
  id SERIAL PRIMARY KEY,
  calc_date DATE NOT NULL,
  k_total NUMERIC(5,4),
  k_sales NUMERIC(5,4),
  k_production NUMERIC(5,4),
  k_speed NUMERIC(5,4),
  k_turnover NUMERIC(5,4),
  sales_fact NUMERIC(14,2),
  sales_plan NUMERIC(14,2),
  houses_fact INT,
  houses_plan INT,
  avg_duration_days NUMERIC(6,2),
  alert_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE system_norms (
  id SERIAL PRIMARY KEY,
  key VARCHAR(80) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  label VARCHAR(200),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);