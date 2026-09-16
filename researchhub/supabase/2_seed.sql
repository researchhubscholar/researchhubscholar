-- ============================================================
-- SEED — dados de um departamento real para validar o produto
-- ANTES de construir cadastro/admin. Popule direto no banco.
-- ============================================================

insert into universities (id, name, short_name, city, state)
values ('11111111-1111-1111-1111-111111111111', 'Universidade Exemplo', 'UEX', 'Campinas', 'SP');

insert into departments (id, university_id, name, description)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Departamento de Clínica Médica',
  'Ensino, pesquisa e extensão em clínica médica e especialidades.'
);

insert into laboratories (id, department_id, name, description, location)
values
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222',
   'Laboratório de Cardiologia Clínica', 'Pesquisa translacional em doenças cardiovasculares.', 'Bloco C, sala 204'),
  ('33333333-3333-3333-3333-333333333334', '22222222-2222-2222-2222-222222222222',
   'Núcleo de IA Aplicada à Saúde', 'Modelos preditivos e apoio à decisão clínica.', 'Bloco D, sala 101');

insert into research_lines (id, laboratory_id, department_id, name, description, keywords)
values
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222', 'Cardiologia Clínica',
   'Diagnóstico e tratamento de doenças cardiovasculares.', array['coração','arritmia','insuficiência cardíaca']),
  ('44444444-4444-4444-4444-444444444445', '33333333-3333-3333-3333-333333333334',
   '22222222-2222-2222-2222-222222222222', 'IA Aplicada à Saúde',
   'Machine learning para predição de risco cardiovascular.', array['IA','machine learning','predição de risco']);

insert into professors (id, department_id, name, email, specialty, bio, accepting_students, lattes_url)
values
  ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222',
   'Dra. Ana Beatriz Ferreira', 'ana.ferreira@uex.br', 'Cardiologia Clínica',
   'Pesquisadora com foco em insuficiência cardíaca e reabilitação.', true, 'http://lattes.cnpq.br/exemplo1'),
  ('55555555-5555-5555-5555-555555555556', '22222222-2222-2222-2222-222222222222',
   'Dr. Carlos Eduardo Lima', 'carlos.lima@uex.br', 'Cardiologia Intervencionista',
   'Atua em hemodinâmica e novas técnicas de cateterismo.', false, 'http://lattes.cnpq.br/exemplo2'),
  ('55555555-5555-5555-5555-555555555557', '22222222-2222-2222-2222-222222222222',
   'Dra. Fernanda Souza', 'fernanda.souza@uex.br', 'IA aplicada à Cardiologia',
   'Desenvolve modelos preditivos para risco cardiovascular em populações jovens.', true, 'http://lattes.cnpq.br/exemplo3');

insert into professor_research_lines (professor_id, research_line_id) values
  ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444'),
  ('55555555-5555-5555-5555-555555555556', '44444444-4444-4444-4444-444444444444'),
  ('55555555-5555-5555-5555-555555555557', '44444444-4444-4444-4444-444444444445');

insert into professor_laboratories (professor_id, laboratory_id, role) values
  ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'Coordenadora'),
  ('55555555-5555-5555-5555-555555555556', '33333333-3333-3333-3333-333333333333', 'Pesquisador'),
  ('55555555-5555-5555-5555-555555555557', '33333333-3333-3333-3333-333333333334', 'Coordenadora');

insert into laboratory_research_lines (laboratory_id, research_line_id) values
  ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444'),
  ('33333333-3333-3333-3333-333333333334', '44444444-4444-4444-4444-444444444445');

insert into projects (id, title, summary, research_line_id, laboratory_id, lead_professor_id, status, accepting_students, scholarship_available, keywords)
values
  ('66666666-6666-6666-6666-666666666666',
   'Reabilitação cardíaca em pacientes pós-infarto',
   'Estudo prospectivo sobre protocolos de reabilitação e qualidade de vida.',
   '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
   '55555555-5555-5555-5555-555555555555', 'recruiting', true, true,
   array['reabilitação','infarto','qualidade de vida']),
  ('66666666-6666-6666-6666-666666666667',
   'Modelo preditivo de risco cardiovascular em jovens adultos',
   'Aplicação de machine learning em dados de check-up para prever risco em 10 anos.',
   '44444444-4444-4444-4444-444444444445', '33333333-3333-3333-3333-333333333334',
   '55555555-5555-5555-5555-555555555557', 'recruiting', true, false,
   array['machine learning','risco cardiovascular','predição']),
  ('66666666-6666-6666-6666-666666666668',
   'Novas técnicas de cateterismo em pacientes de alto risco',
   'Avaliação comparativa de técnicas intervencionistas.',
   '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
   '55555555-5555-5555-5555-555555555556', 'ongoing', false, false,
   array['cateterismo','hemodinâmica']);
