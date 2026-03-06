# CondoManager - Condo Property Management Platform

## Overview
A scalable web application for managing condo associations, units, people, ownership records, occupancy tracking, board membership, and document uploads.

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui components
- **Backend**: Node.js + Express REST API
- **Database**: PostgreSQL with Drizzle ORM
- **File Uploads**: Multer (stored in /uploads directory)
- **Routing**: wouter (frontend), Express (backend)
- **State Management**: TanStack React Query

## Project Structure

### Frontend (`client/src/`)
- `App.tsx` - Main app with sidebar layout and routing
- `components/app-sidebar.tsx` - Navigation sidebar
- `pages/dashboard.tsx` - Dashboard with stats cards
- `pages/associations.tsx` - CRUD for associations
- `pages/units.tsx` - CRUD for units
- `pages/persons.tsx` - CRUD for people
- `pages/owners.tsx` - Ownership assignment
- `pages/occupancy.tsx` - Occupancy tracking
- `pages/board.tsx` - Board role assignment
- `pages/documents.tsx` - Document upload/management

### Backend (`server/`)
- `index.ts` - Express app setup + seed
- `routes.ts` - All REST API endpoints
- `storage.ts` - Database storage layer (IStorage interface)
- `db.ts` - Drizzle + pg pool
- `seed.ts` - Database seeding with sample data

### Shared (`shared/`)
- `schema.ts` - Drizzle schema + Zod validation + TypeScript types

## Data Model
- **Association** - Condo complexes
- **Unit** - Individual units within associations
- **Person** - People in the system
- **Ownership** - Links people to units as owners (supports multiple/historical)
- **Occupancy** - Tracks owner-occupied vs tenant
- **BoardRole** - Board membership positions
- **Document** - Uploaded association documents

## API Endpoints
All prefixed with `/api/`:
- GET/POST `/associations`, PATCH `/associations/:id`
- GET/POST `/units`, PATCH `/units/:id`
- GET/POST `/persons`, PATCH `/persons/:id`
- GET/POST `/ownerships`
- GET/POST `/occupancies`
- GET/POST `/board-roles`
- GET/POST `/documents` (multipart upload)
- GET `/uploads/:filename` (serve uploaded files)
- GET `/dashboard/stats`
