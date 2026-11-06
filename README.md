# CoTrain — Cooperative Training Platform

CoTrain is a full-stack web application designed to connect students with companies offering cooperative training opportunities.

The platform provides dedicated experiences for students, companies, and administrators, supporting internship discovery, applications, and training opportunity management.

## Features

### Students
- Browse companies and internship opportunities
- Search and filter available internships
- View detailed internship information
- Register and log in
- Submit and manage applications through the student dashboard

### Companies
- Access a dedicated company dashboard
- Manage internship opportunities
- Review student applications

### Administrators
- Access a role-protected administration dashboard
- Manage supported platform administration workflows

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite, CSS |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| Authentication | Express Session, bcrypt |
| Security | CSRF Protection, Rate Limiting, Role-Based Access Control |
| Version Control | Git, GitHub |

## Project Structure

```text
Cooperative-Training-Platform/
├── backend/
│   ├── middleware/
│   ├── routes/
│   ├── db.js
│   └── server.js
├── database/
│   └── schema.sql
├── frontend/
│   ├── public/
│   └── src/
├── docs/
└── README.md
```

## Local Development

### Prerequisites

- Node.js and npm
- PostgreSQL

### Backend

```bash
cd backend
npm install
npm start
```

The backend requires local environment configuration and a PostgreSQL database.

### Frontend

Open a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs locally using Vite.

### Environment Variables

Configure the backend's local `.env` file with the required database and session settings.

Never commit real passwords, session secrets, or API keys.

## Project Status

CoTrain is a portfolio project developed to demonstrate full-stack software engineering skills, including frontend development, REST API integration, relational databases, authentication, authorization, and role-based dashboards.

## Author

**Dana Almutairi**

Software Engineering Graduate