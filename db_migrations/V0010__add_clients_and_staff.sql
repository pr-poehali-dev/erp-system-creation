-- ШАГ 2: Добавляем клиентов (6 и 7)
INSERT INTO t_p60494808_erp_system_creation.clients (name, phone, email, source) VALUES
  ('Орлов Дмитрий Михайлович',   '+7 926 654-32-10', 'orlov@mail.ru',     'Инстаграм'),
  ('Волкова Анастасия Сергеевна','+7 908 777-88-99', 'volkova@gmail.com', 'Рекомендация');

-- Добавляем сотрудников (снабженец + механик + бухгалтер)
INSERT INTO t_p60494808_erp_system_creation.staff (name, role) VALUES
  ('Романов Сергей Игоревич',  'foreman'),
  ('Волков Вадим Олегович',    'mechanic'),
  ('Смирнова Ольга Андреевна', 'accountant'),
  ('Дмитриев Артём Павлович',  'supplier');