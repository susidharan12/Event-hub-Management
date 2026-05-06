--
-- PostgreSQL database dump
--

\restrict Vx16b7Tywp33wofNW1McEGdx97b6CkiSmfzqSBvQMuJUF8DLMT9ywmFNTktF7ah

-- Dumped from database version 17.7
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE public.users DISABLE TRIGGER ALL;

INSERT INTO public.users (id, name, mobile, role, email, password_hash, created_at, updated_at, profile_image, address, organization_name, organization_address, organization_phone, organization_website, organization_description, last_seen) VALUES (2, 'Karthik k', '5656565656', 'organizer', 'karthik@gmail.com', '$2a$10$wYkk5x5WZRElbz/uFilzsuhvwfr74NTJ3Vl61AG/yMWpJTF6Lg2LG', '2026-02-11 19:53:32.513185', '2026-02-11 19:53:32.513185', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-29 12:04:33.235083');
INSERT INTO public.users (id, name, mobile, role, email, password_hash, created_at, updated_at, profile_image, address, organization_name, organization_address, organization_phone, organization_website, organization_description, last_seen) VALUES (4, 'Susidharan A', '9087678909', 'organizer', 'ashok@gmail.com', '$2a$10$rWhMk.RkUO1sVY3B0q58LejRbAk0RbdV75KsmAzOFFw4N5x/4HeuO', '2026-04-04 11:29:58.876794', '2026-04-04 11:29:58.876794', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-29 12:04:33.235083');
INSERT INTO public.users (id, name, mobile, role, email, password_hash, created_at, updated_at, profile_image, address, organization_name, organization_address, organization_phone, organization_website, organization_description, last_seen) VALUES (5, 'Susidharan A', '9360689650', 'organizer', 'devilsusi27@gmail.com', '$2a$10$oUzDZHPsbKvWyrDpCnh/9OvLBRDomTU6VW9HoK20WJwOWQs00yBd.', '2026-04-27 19:53:27.410096', '2026-04-27 19:53:27.410096', '/uploads/avatar-1777448993716.jpeg', NULL, 'Happy Street Acadamy', 'Coimbatore', '9360689659', 'https://google.com', 'Make fun with us', '2026-05-05 15:15:13.058834');
INSERT INTO public.users (id, name, mobile, role, email, password_hash, created_at, updated_at, profile_image, address, organization_name, organization_address, organization_phone, organization_website, organization_description, last_seen) VALUES (6, 'OrgTest User Updated', '9999999991', 'organizer', 'orgtest+1@example.com', '$2a$10$R2RgS.O0RFq/eudLQMc86eXMsW4EXaPEYrrvJeZJg7X888mtgT/gm', '2026-04-28 18:06:04.577652', '2026-04-28 18:06:04.577652', '/uploads/avatar-1777380170504.jpg', NULL, 'Acme Events', '42 Demo Street, Coimbatore', '08000000000', 'https://acme.events', 'Updated via PUT smoke test', '2026-04-29 14:46:30.280354');
INSERT INTO public.users (id, name, mobile, role, email, password_hash, created_at, updated_at, profile_image, address, organization_name, organization_address, organization_phone, organization_website, organization_description, last_seen) VALUES (7, 'OwnerTest', '9999111100', 'organizer', 'owner+test@example.com', '$2a$10$GOlJkPex/c41uZ4Pr8DwauB4Z.h071na4f.oAkHViDbDVlDa5WeVK', '2026-04-29 10:59:01.871666', '2026-04-29 10:59:01.871666', NULL, NULL, 'Owner Co', '123 Demo St', NULL, NULL, NULL, '2026-04-29 14:46:30.701289');
INSERT INTO public.users (id, name, mobile, role, email, password_hash, created_at, updated_at, profile_image, address, organization_name, organization_address, organization_phone, organization_website, organization_description, last_seen) VALUES (1, 'Susidharan A', '9360689659', 'organizer', 'susi@gmail.com', '$2a$10$VCu6U2YvKwk0005aZfAZxuh0R5FcsV5eZd99VVP5VOVVyaMhYNQOW', '2026-02-11 19:45:14.199752', '2026-02-11 19:45:14.199752', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-29 12:04:33.235083');
INSERT INTO public.users (id, name, mobile, role, email, password_hash, created_at, updated_at, profile_image, address, organization_name, organization_address, organization_phone, organization_website, organization_description, last_seen) VALUES (3, 'Mukeesh M', '1234567891', 'explorer', 'mukeesh@gmail.com', '$2a$10$Q43GAuralox6ytarjn632OWwVyN7k1rxNj6ycURdConXmBGDxErfm', '2026-02-12 10:24:47.171751', '2026-02-12 10:24:47.171751', '/uploads/avatar-1777382709725.jpeg', NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-29 13:34:27.364813');
INSERT INTO public.users (id, name, mobile, role, email, password_hash, created_at, updated_at, profile_image, address, organization_name, organization_address, organization_phone, organization_website, organization_description, last_seen) VALUES (10, 'Avinash P', '7854875487', 'explorer', 'avinash@gmail.com', '$2a$10$p6d6kvXIxZTgVkw0tvp19unXXWC7QfF.chZdvTkYujf3K/NEtcI22', '2026-05-04 18:32:29.950286', '2026-05-04 18:32:29.950286', '/uploads/avatar-1777899796423.jpg', NULL, NULL, NULL, NULL, NULL, NULL, '2026-05-05 13:07:33.401242');
INSERT INTO public.users (id, name, mobile, role, email, password_hash, created_at, updated_at, profile_image, address, organization_name, organization_address, organization_phone, organization_website, organization_description, last_seen) VALUES (8, 'Sanjay', '9629232936', 'explorer', 'sanjay02@gmail.com', '$2a$10$yhHEz/2eNzU7F2LTKGdqHObKoU/R.ooX1Vr1SD.9Bv.jSiPC/U8ua', '2026-04-29 13:28:00.723151', '2026-04-29 13:28:00.723151', '/uploads/avatar-1777449532727.jpeg', NULL, NULL, NULL, NULL, NULL, NULL, '2026-05-05 14:50:01.753378');


ALTER TABLE public.users ENABLE TRIGGER ALL;

--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.events DISABLE TRIGGER ALL;

INSERT INTO public.events (id, organizer_id, title, description, location, event_date, ticket_price, total_seats, available_seats, image_url, category, created_at, updated_at, images, place, map_url) VALUES (12, 7, 'Edit Demo (Updated)', 'Initial description', 'Initial Venue', '2026-08-01 18:00:00', 250.00, 50, 50, '/uploads/1777440542354.jpg', 'Tech', '2026-04-29 10:59:02.359929', '2026-04-29 10:59:02.359929', '{}', 'Coimbatore', 'https://maps.app.goo.gl/abc123');
INSERT INTO public.events (id, organizer_id, title, description, location, event_date, ticket_price, total_seats, available_seats, image_url, category, created_at, updated_at, images, place, map_url) VALUES (8, 1, 'Test Smoke Event', 'End-to-end smoke test from dashboard fix', 'Chennai Test Venue', '2026-06-15 10:00:00', 499.00, 120, 118, '/uploads/1777373972020.jpg', 'Tech', '2026-04-28 16:29:32.142424', '2026-04-28 16:29:32.142424', '{}', NULL, NULL);
INSERT INTO public.events (id, organizer_id, title, description, location, event_date, ticket_price, total_seats, available_seats, image_url, category, created_at, updated_at, images, place, map_url) VALUES (7, 1, 'Cars show', 'car show exclusive', 'Chennai', '2026-03-02 16:06:00', 0.00, 200, 181, NULL, 'Sports', '2026-02-12 16:06:42.210427', '2026-02-12 16:06:42.210427', NULL, NULL, NULL);
INSERT INTO public.events (id, organizer_id, title, description, location, event_date, ticket_price, total_seats, available_seats, image_url, category, created_at, updated_at, images, place, map_url) VALUES (6, 1, 'RGF', 'fest', 'Rathinam Technical Campus, Coimbatore', '2026-02-28 14:02:00', 0.00, 1499, 1496, NULL, 'Cultural fest', '2026-02-12 14:02:40.71059', '2026-02-12 14:02:40.71059', NULL, NULL, NULL);
INSERT INTO public.events (id, organizer_id, title, description, location, event_date, ticket_price, total_seats, available_seats, image_url, category, created_at, updated_at, images, place, map_url) VALUES (13, 5, 'Payment Checking', 'payment checking', 'Opp to le-meridian', '2026-05-07 14:25:00', 1.00, 200, 199, '/uploads/1777559190919.webp', 'Gathering', '2026-04-30 19:56:30.933932', '2026-04-30 19:56:30.933932', '{}', 'Chennai', NULL);
INSERT INTO public.events (id, organizer_id, title, description, location, event_date, ticket_price, total_seats, available_seats, image_url, category, created_at, updated_at, images, place, map_url) VALUES (11, 5, 'IT meeting reunion', 'reunion', 'Rathinam Technical Campus', '2026-05-07 06:29:00', 0.00, 200, 190, '/uploads/1777441856472.jpeg', 'Gathering', '2026-04-29 10:38:19.784381', '2026-04-29 10:38:19.784381', '{/uploads/1777439299584.jpeg,/uploads/1777439299589.jpg,/uploads/1777439299590.jpeg,/uploads/1777439299595.jpeg,/uploads/1777439299601.jpeg,/uploads/1777439299603.jpeg,/uploads/1777439299604.jpeg,/uploads/1777439299620.jpeg,/uploads/1777439299626.jpeg,/uploads/1777439299633.JPEG}', 'Coimbatore', 'https://maps.app.goo.gl/w2akCxq4ryZa2Ykx7');


ALTER TABLE public.events ENABLE TRIGGER ALL;

--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.bookings DISABLE TRIGGER ALL;

INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (1, 6, 7, '2026-04-28 18:47:21.517293', 3, 0.00, 'confirmed', '2026-04-28 18:47:21.517293', '2026-04-28 18:47:21.517293', 'OrgTest User Updated', 'orgtest+1@example.com', '9999999991', NULL, 'TKT-OLKY09YLU', NULL, NULL, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (2, 6, 7, '2026-04-28 18:47:22.098087', 7, 0.00, 'confirmed', '2026-04-28 18:47:22.098087', '2026-04-28 18:47:22.098087', 'OrgTest User Updated', 'orgtest+1@example.com', '9999999991', NULL, 'TKT-HGK2D111N', NULL, NULL, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (3, 3, 7, '2026-04-28 18:54:00.083001', 2, 0.00, 'confirmed', '2026-04-28 18:54:00.083001', '2026-04-28 18:54:00.083001', 'John Doe', 'mukeesh@gmail.com', '1234567890', 'TXN-C0598QEQ3', 'TKT-OWGSO2J6C', NULL, NULL, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (4, 3, 7, '2026-04-28 18:55:47.490986', 3, 0.00, 'confirmed', '2026-04-28 18:55:47.490986', '2026-04-28 18:55:47.490986', 'John Doe', 'mukeesh@gmail.com', '1234567891', 'TXN-MS7EU53NU', 'TKT-T1Q6KLI7J', NULL, NULL, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (6, 3, 7, '2026-04-28 19:44:24.641472', 2, 0.00, 'confirmed', '2026-04-28 19:44:24.641472', '2026-04-28 19:44:24.641472', 'John Doe', 'mukeesh@gmail.com', '1234567891', 'TXN-20ANF7D7Z', 'TKT-194SHBFOD', NULL, NULL, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (7, 3, 7, '2026-04-29 10:08:55.433407', 2, 0.00, 'confirmed', '2026-04-29 10:08:55.433407', '2026-04-29 10:08:55.433407', 'John Doe', 'mukeesh@gmail.com', '1234567891', 'TXN-PDGQROWJM', 'TKT-3EP9MOAVZ', NULL, NULL, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (8, 3, 11, '2026-04-29 10:52:25.632615', 3, 0.00, 'confirmed', '2026-04-29 10:52:25.632615', '2026-04-29 10:52:25.632615', 'susi', 'mukeesh@gmail.com', '1234567891', 'TXN-76ZDC25XK', 'TKT-AXUOOGX7Z', NULL, NULL, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (9, 6, 6, '2026-04-29 10:58:21.53503', 2, 0.00, 'confirmed', '2026-04-29 10:58:21.53503', '2026-04-29 10:58:21.53503', 'Test User', 'orgtest+1@example.com', '9999999991', NULL, 'TKT-VFLHL2WS3', NULL, NULL, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (10, 6, 6, '2026-04-29 10:58:21.800296', 1, 0.00, 'confirmed', '2026-04-29 10:58:21.800296', '2026-04-29 10:58:21.800296', 'Test User', 'orgtest+1@example.com', '9999999991', NULL, 'TKT-H9PKCPJ59', NULL, NULL, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (12, 3, 11, '2026-04-29 11:06:59.631845', 2, 0.00, 'confirmed', '2026-04-29 11:06:59.631845', '2026-04-29 11:06:59.631845', 'Mukeesh M', 'mukeesh@gmail.com', '1234567891', 'TXN-YCV9RNI89', 'TKT-P034FE1NG', NULL, NULL, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (13, 6, 8, '2026-04-29 12:37:42.667521', 2, 998.00, 'cancelled', '2026-04-29 12:37:42.667521', '2026-04-29 12:37:42.667521', 'OrgTest User Updated', 'orgtest+1@example.com', '9999999991', NULL, 'TKT-ZC9YLK5AF', '2026-04-29 12:37:43.961875', 998.00, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (11, 3, 12, '2026-04-29 11:01:00.456376', 1, 250.00, 'cancelled', '2026-04-29 11:01:00.456376', '2026-04-29 11:01:00.456376', 'Mukeesh M', 'mukeesh@gmail.com', '1234567891', 'TXN-8P5JHBOE2', 'TKT-G56HW9PJ0', '2026-04-29 12:41:56.358454', 250.00, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (14, 3, 11, '2026-04-29 13:20:45.049929', 3, 0.00, 'confirmed', '2026-04-29 13:20:45.049929', '2026-04-29 13:20:45.049929', 'Mukeesh M', 'mukeesh@gmail.com', '1234567891', 'TXN-9OKHDFVDK', 'TKT-5HYRFHR8I', NULL, NULL, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (16, 8, 11, '2026-04-29 13:28:16.587568', 1, 0.00, 'cancelled', '2026-04-29 13:28:16.587568', '2026-04-29 13:28:16.587568', 'Sanjay', 'sanjay@gmail.com', '0987098709', 'TXN-0B5Z8LNXY', 'TKT-MA13T8ILJ', '2026-04-29 14:37:55.861645', 0.00, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (15, 6, 12, '2026-04-29 13:25:52.243201', 2, 500.00, 'cancelled', '2026-04-29 13:25:52.243201', '2026-04-29 13:25:52.243201', 'Susi A', 'orgtest+1@example.com', '9999999991', NULL, 'TKT-7RUVTTAA5', '2026-04-29 14:46:30.42335', 500.00, 'Schedule conflict � work meeting on the same day');
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (17, 8, 8, '2026-04-29 18:51:00.863369', 1, 499.00, 'confirmed', '2026-04-29 18:51:00.863369', '2026-04-29 18:51:00.863369', 'Sanjay', 'sanjay@gmail.com', '0987098709', 'TXN-AYC4Z8D63', 'TKT-V4YQNAOUT', NULL, NULL, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (18, 8, 8, '2026-04-29 18:51:31.619699', 1, 499.00, 'confirmed', '2026-04-29 18:51:31.619699', '2026-04-29 18:51:31.619699', 'Sanjay', 'sanjay@gmail.com', '0987098709', 'TXN-0CX015474', 'TKT-2XX1PDIJX', NULL, NULL, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (21, 8, 13, '2026-04-30 20:22:36.753446', 1, 1.00, 'confirmed', '2026-04-30 20:22:36.753446', '2026-04-30 20:22:36.753446', 'Sanjay', 'sanjay@gmail.com', '0987098709', 'TXN-068E6RSV4', 'TKT-8Z0SM89KV', NULL, NULL, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (19, 8, 13, '2026-04-30 19:56:59.812605', 1, 1.00, 'cancelled', '2026-04-30 19:56:59.812605', '2026-04-30 19:56:59.812605', 'Sanjay', 'sanjay@gmail.com', '0987098709', 'TXN-QTDU0QUZH', 'TKT-ZP0T33942', '2026-04-30 20:24:46.145567', 1.00, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (20, 8, 13, '2026-04-30 20:02:36.398911', 1, 1.00, 'cancelled', '2026-04-30 20:02:36.398911', '2026-04-30 20:02:36.398911', 'Sanjay', 'sanjay@gmail.com', '0987098709', 'TXN-S5VU4V0L5', 'TKT-ZQ6TXN5MN', '2026-04-30 20:24:56.278108', 1.00, NULL);
INSERT INTO public.bookings (id, user_id, event_id, booking_date, number_of_seats, total_price, status, created_at, updated_at, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, ticket_id, cancelled_at, refund_amount, cancellation_reason) VALUES (22, 8, 11, '2026-05-05 12:13:51.544737', 2, 0.00, 'confirmed', '2026-05-05 12:13:51.544737', '2026-05-05 12:13:51.544737', 'Sanjay', 'sanjay02@gmail.com', '9629232936', 'TXN-MLUJD9YCH', 'TKT-Q3OSV5L9X', NULL, NULL, NULL);


ALTER TABLE public.bookings ENABLE TRIGGER ALL;

--
-- Data for Name: check_ins; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.check_ins DISABLE TRIGGER ALL;



ALTER TABLE public.check_ins ENABLE TRIGGER ALL;

--
-- Data for Name: checkins; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.checkins DISABLE TRIGGER ALL;



ALTER TABLE public.checkins ENABLE TRIGGER ALL;

--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.messages DISABLE TRIGGER ALL;

INSERT INTO public.messages (id, event_id, sender_id, recipient_id, body, read_at, created_at, edited_at) VALUES (1, 6, 6, 1, 'Hi! Quick question about the event.', NULL, '2026-04-29 11:47:35.001584', NULL);
INSERT INTO public.messages (id, event_id, sender_id, recipient_id, body, read_at, created_at, edited_at) VALUES (2, 6, 6, 1, 'Where exactly should I park?', NULL, '2026-04-29 11:52:06.53569', NULL);
INSERT INTO public.messages (id, event_id, sender_id, recipient_id, body, read_at, created_at, edited_at) VALUES (3, 11, 3, 5, 'Hii bri', '2026-04-29 11:53:44.62718', '2026-04-29 11:53:27.823969', NULL);
INSERT INTO public.messages (id, event_id, sender_id, recipient_id, body, read_at, created_at, edited_at) VALUES (4, 11, 5, 3, 'Yes tell me bro, whats your doubt', '2026-04-29 11:54:05.03961', '2026-04-29 11:54:03.404552', NULL);
INSERT INTO public.messages (id, event_id, sender_id, recipient_id, body, read_at, created_at, edited_at) VALUES (5, 11, 3, 5, 'Broooo!!!!!!!!!!!!!!!!!!!!!!!!!!!!', '2026-04-29 12:06:44.535218', '2026-04-29 12:06:26.181088', NULL);
INSERT INTO public.messages (id, event_id, sender_id, recipient_id, body, read_at, created_at, edited_at) VALUES (6, 11, 8, 5, 'Hii', '2026-04-29 13:30:40.539827', '2026-04-29 13:30:31.140179', NULL);
INSERT INTO public.messages (id, event_id, sender_id, recipient_id, body, read_at, created_at, edited_at) VALUES (7, 11, 5, 8, 'Hii', '2026-04-29 13:30:52.321784', '2026-04-29 13:30:51.236553', NULL);
INSERT INTO public.messages (id, event_id, sender_id, recipient_id, body, read_at, created_at, edited_at) VALUES (8, 11, 8, 5, 'hiiiiiiiii', '2026-04-29 19:04:04.309058', '2026-04-29 19:04:00.214594', NULL);
INSERT INTO public.messages (id, event_id, sender_id, recipient_id, body, read_at, created_at, edited_at) VALUES (9, 11, 5, 8, 'hiiiiiiiiiiiiii uuuuuuu', '2026-04-29 19:04:11.977097', '2026-04-29 19:04:11.084628', NULL);
INSERT INTO public.messages (id, event_id, sender_id, recipient_id, body, read_at, created_at, edited_at) VALUES (10, 11, 8, 5, 'Bro i am sanjay', '2026-04-30 16:35:33.999128', '2026-04-30 16:35:29.441464', NULL);
INSERT INTO public.messages (id, event_id, sender_id, recipient_id, body, read_at, created_at, edited_at) VALUES (11, 11, 5, 8, 'yes tell me bro how can i help you', '2026-04-30 16:35:52.384466', '2026-04-30 16:35:49.907537', NULL);
INSERT INTO public.messages (id, event_id, sender_id, recipient_id, body, read_at, created_at, edited_at) VALUES (12, 11, 8, 5, 'event detail venum bro', '2026-04-30 16:49:53.696444', '2026-04-30 16:36:13.182022', NULL);
INSERT INTO public.messages (id, event_id, sender_id, recipient_id, body, read_at, created_at, edited_at) VALUES (13, 11, 8, 5, 'Hey prabhu', '2026-04-30 16:58:10.89959', '2026-04-30 16:57:40.166369', NULL);
INSERT INTO public.messages (id, event_id, sender_id, recipient_id, body, read_at, created_at, edited_at) VALUES (14, 11, 5, 8, 'yes bro', '2026-04-30 16:58:19.742701', '2026-04-30 16:58:17.801387', NULL);
INSERT INTO public.messages (id, event_id, sender_id, recipient_id, body, read_at, created_at, edited_at) VALUES (15, 11, 8, 5, 'hiii', '2026-05-04 11:57:39.635422', '2026-04-30 17:07:19.911245', NULL);
INSERT INTO public.messages (id, event_id, sender_id, recipient_id, body, read_at, created_at, edited_at) VALUES (16, 11, 8, 5, 'hiiiii', '2026-05-04 11:57:39.635422', '2026-04-30 17:09:14.71018', '2026-04-30 17:17:41.83041');


ALTER TABLE public.messages ENABLE TRIGGER ALL;

--
-- Data for Name: organizer_payments; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.organizer_payments DISABLE TRIGGER ALL;



ALTER TABLE public.organizer_payments ENABLE TRIGGER ALL;

--
-- Data for Name: otps; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.otps DISABLE TRIGGER ALL;

INSERT INTO public.otps (id, target, target_type, code, purpose, attempts, verified, verification_token, token_expires_at, expires_at, created_at) VALUES (4, 'test@example.com', 'email', '515065', 'signup', 1, false, NULL, NULL, '2026-04-29 16:24:02.537', '2026-04-29 16:14:02.538808');
INSERT INTO public.otps (id, target, target_type, code, purpose, attempts, verified, verification_token, token_expires_at, expires_at, created_at) VALUES (5, 'susidharan.softsuave@gmail.com', 'email', '904587', 'update-email', 0, true, '6cb8a040d2741ac36ce0806e1e10ebeb41722eed40281424', '2026-04-29 16:31:13.123', '2026-04-29 16:25:44.082', '2026-04-29 16:15:44.085888');
INSERT INTO public.otps (id, target, target_type, code, purpose, attempts, verified, verification_token, token_expires_at, expires_at, created_at) VALUES (8, '0987098709', 'mobile', '404152', 'password-reset', 0, true, '372288d3bf274506e1c23558b28a218ef6f8f6e4adf9faf0', '2026-04-29 16:43:24.379', '2026-04-29 16:38:05.521', '2026-04-29 16:28:05.525896');
INSERT INTO public.otps (id, target, target_type, code, purpose, attempts, verified, verification_token, token_expires_at, expires_at, created_at) VALUES (11, 'new-test@test.com', 'email', '675845', 'signup', 0, false, NULL, NULL, '2026-05-04 18:28:42.551', '2026-05-04 18:18:42.568615');
INSERT INTO public.otps (id, target, target_type, code, purpose, attempts, verified, verification_token, token_expires_at, expires_at, created_at) VALUES (15, 'avinash@gmail.com', 'email', '266411', 'signup', 1, true, '1e1be8cdaae9021aedd937e4fca9d7433bc0ee7eee297fcb', '2026-05-04 18:47:29.759', '2026-05-04 18:41:55.966', '2026-05-04 18:31:56.01838');
INSERT INTO public.otps (id, target, target_type, code, purpose, attempts, verified, verification_token, token_expires_at, expires_at, created_at) VALUES (16, 'avinash@gmail.com', 'email', '104735', 'update-email', 0, true, '31eb0976012210449546ee5e9fd0740bc67d18b93b6d5b1a', '2026-05-04 18:48:31.564', '2026-05-04 18:43:18.305', '2026-05-04 18:33:18.3103');
INSERT INTO public.otps (id, target, target_type, code, purpose, attempts, verified, verification_token, token_expires_at, expires_at, created_at) VALUES (17, '7854875487', 'mobile', '200364', 'update-mobile', 0, true, '747fcb6d7d3549995db6e9a9c0ba36f74fcdac34f7f46389', '2026-05-04 18:48:43.799', '2026-05-04 18:43:31.585', '2026-05-04 18:33:31.58731');


ALTER TABLE public.otps ENABLE TRIGGER ALL;

--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.payments DISABLE TRIGGER ALL;



ALTER TABLE public.payments ENABLE TRIGGER ALL;

--
-- Name: bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bookings_id_seq', 22, true);


--
-- Name: check_ins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.check_ins_id_seq', 1, false);


--
-- Name: checkins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.checkins_id_seq', 1, false);


--
-- Name: events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.events_id_seq', 13, true);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.messages_id_seq', 16, true);


--
-- Name: organizer_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.organizer_payments_id_seq', 1, false);


--
-- Name: otps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.otps_id_seq', 17, true);


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payments_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 10, true);


--
-- PostgreSQL database dump complete
--

\unrestrict Vx16b7Tywp33wofNW1McEGdx97b6CkiSmfzqSBvQMuJUF8DLMT9ywmFNTktF7ah

