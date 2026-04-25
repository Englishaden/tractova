-- ─────────────────────────────────────────────────────────────────────────────
-- Substations seed — from static substationEngine.js (EIA Form 860)
-- Safe to re-run — uses ON CONFLICT DO UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────

insert into substations (state_id, name, lat, lon, voltage_kv, capacity_mw, utility) values
-- Illinois
('IL', 'Pontiac 138kV',   40.88, -88.63, 138, 45,  'ComEd'),
('IL', 'Dixon 345kV',     41.84, -89.48, 345, 120, 'ComEd'),
('IL', 'Elwood 765kV',    41.40, -88.11, 765, 350, 'ComEd'),
('IL', 'DeWitt 345kV',    40.17, -88.90, 345, 95,  'Ameren'),
('IL', 'Coffeen 345kV',   39.07, -89.40, 345, 110, 'Ameren'),
('IL', 'Kincaid 345kV',   39.58, -89.42, 345, 80,  'Ameren'),
('IL', 'Lombard 138kV',   41.88, -88.01, 138, 55,  'ComEd'),
('IL', 'Rockford 138kV',  42.27, -89.09, 138, 40,  'ComEd'),
('IL', 'Marion 138kV',    37.73, -88.93, 138, 35,  'Ameren'),
('IL', 'Quincy 138kV',    39.93, -91.41, 138, 30,  'Ameren'),
-- New York
('NY', 'Marcy 765kV',           43.17, -75.27, 765, 400, 'National Grid'),
('NY', 'Dunwoodie 345kV',       40.94, -73.87, 345, 200, 'ConEdison'),
('NY', 'Pleasant Valley 345kV', 41.75, -73.82, 345, 150, 'Central Hudson'),
('NY', 'Rotterdam 230kV',       42.79, -74.00, 230, 90,  'National Grid'),
('NY', 'Oakdale 138kV',         40.74, -73.14, 138, 60,  'PSEG LI'),
('NY', 'Massena 230kV',         44.93, -74.89, 230, 70,  'National Grid'),
('NY', 'Niagara 345kV',         43.08, -79.04, 345, 180, 'National Grid'),
('NY', 'Albany 115kV',           42.65, -73.76, 115, 45,  'National Grid'),
-- Massachusetts
('MA', 'West Medway 345kV',    42.14, -71.42, 345, 160, 'National Grid'),
('MA', 'Millbury 345kV',       42.20, -71.77, 345, 140, 'National Grid'),
('MA', 'Canal 345kV',          41.73, -70.61, 345, 120, 'Eversource'),
('MA', 'Brayton Point 345kV',  41.70, -71.18, 345, 130, 'Eversource'),
('MA', 'Ludlow 115kV',         42.18, -72.47, 115, 50,  'Eversource'),
('MA', 'Pittsfield 115kV',     42.45, -73.25, 115, 35,  'Eversource'),
-- Minnesota
('MN', 'Blue Lake 345kV',   44.94, -93.44, 345, 180, 'Xcel Energy'),
('MN', 'Sherco 345kV',      45.38, -93.89, 345, 200, 'Xcel Energy'),
('MN', 'Chisago 345kV',     45.37, -92.89, 345, 120, 'Xcel Energy'),
('MN', 'Red Wing 115kV',    44.56, -92.53, 115, 45,  'Xcel Energy'),
('MN', 'Marshall 115kV',    44.45, -95.79, 115, 40,  'Xcel Energy'),
('MN', 'Wilmarth 345kV',    44.15, -93.98, 345, 100, 'Xcel Energy'),
-- Colorado
('CO', 'Comanche 345kV',     38.22, -104.58, 345, 250, 'Xcel Energy'),
('CO', 'Daniels Park 230kV', 39.49, -104.91, 230, 140, 'Xcel Energy'),
('CO', 'Pawnee 230kV',       40.82, -104.72, 230, 110, 'Xcel Energy'),
('CO', 'Ault 230kV',         40.58, -104.73, 230, 90,  'Xcel Energy'),
('CO', 'San Luis 115kV',     37.68, -105.42, 115, 35,  'Xcel Energy'),
('CO', 'Pueblo 115kV',       38.27, -104.61, 115, 50,  'Xcel Energy'),
-- New Jersey
('NJ', 'Linden 230kV',     40.63, -74.24, 230, 160, 'PSE&G'),
('NJ', 'Branchburg 230kV', 40.57, -74.73, 230, 120, 'PSE&G'),
('NJ', 'Deans 230kV',      40.40, -74.50, 230, 100, 'PSE&G'),
('NJ', 'Salem 500kV',      39.46, -75.54, 500, 300, 'PSE&G'),
('NJ', 'Larrabee 230kV',   40.74, -74.19, 230, 110, 'JCP&L'),
-- Maryland
('MD', 'Calvert Cliffs 500kV', 38.43, -76.44, 500, 280, 'BGE'),
('MD', 'Waugh Chapel 230kV',   39.07, -76.68, 230, 120, 'BGE'),
('MD', 'Chalk Point 230kV',    38.53, -76.67, 230, 100, 'Pepco'),
('MD', 'Indian River 138kV',   38.60, -75.06, 138, 55,  'Delmarva'),
-- Maine
('ME', 'Maine Yankee 345kV', 43.95, -69.70, 345, 100, 'CMP'),
('ME', 'Orrington 345kV',    44.73, -68.82, 345, 80,  'Versant'),
('ME', 'Surowiec 345kV',     43.97, -70.13, 345, 90,  'CMP')

on conflict (state_id, name) do update set
  lat = excluded.lat,
  lon = excluded.lon,
  voltage_kv = excluded.voltage_kv,
  capacity_mw = excluded.capacity_mw,
  utility = excluded.utility;
