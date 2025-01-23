# Time Tracker Application

A comprehensive time tracking solution with screenshot capabilities, team management, and detailed reporting. Built with React, Supabase.


## 🌟 Features

- ⏱️ Real-time time tracking
- 📸 Automatic screenshots
- 👥 Team management
- 📊 Detailed reports and analytics
- 🔐 Role-based access control
- 💻 Cross-platform support
## 🏗️ Architecture

### High-Level System Design

```
┌─────────────────┐          ┌─────────────────┐
│   Web Client    │          │    Supabase     │
│   (React/Vite)  │          │   (Backend)     │
├─────────────────┤          ├─────────────────┤
│ - Time Tracking │          │ - Authentication│
│ - Team Views    │          │ - Database      │
│ - Admin Panel   │          │ - File Storage  │
└────────┬────────┘          └────────┬────────┘
         │                            │
         └────────────────────────────┘
                        │
                 ┌──────┴───────┐
                 │   Storage    │
                 │ (Screenshots)│
                 └──────────────┘
```

### Database Schema

```sql
profiles
├── id (uuid, PK)
├── full_name (text)
├── role (enum: employee, manager, admin)
├── manager_id (uuid, FK)
└── timestamps

time_entries
├── id (uuid, PK)
├── user_id (uuid, FK)
├── start_time (timestamp)
├── end_time (timestamp)
├── description (text)
└── timestamps

screenshots
├── id (uuid, PK)
├── time_entry_id (uuid, FK)
├── storage_path (text)
├── taken_at (timestamp)
├── type (text: screen/webcam)
└── timestamps
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Git

### Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/pareekakshat/timetracker
   cd time-tracker
   ```

2. Install dependencies:
   ```bash
   # Web application
   npm install


3. Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

### Database Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)

2. Run the migrations:
   ```bash
   # From the project root
   npx supabase migration up
   ```

3. Set up storage:
   - Create a new bucket named "screenshots"
   - Configure the storage policies as defined in the migrations

### Running the Application

#### Web Application
```bash
# Development
npm run dev

# Production build
npm run build
npm run preview
```

## 🔒 Security

### Row Level Security (RLS)

The application implements comprehensive row-level security in Supabase:

- **Profiles**
  - Users can view/edit their own profile
  - Managers can view their team's profiles
  - Admins have full access

- **Time Entries**
  - Users can manage their own entries
  - Managers can view their team's entries
  - Admins have full access

- **Screenshots**
  - Users can view their own screenshots
  - Managers can view their team's screenshots
  - Admins have full access

### Storage Security

- Screenshots are stored in isolated user-specific paths
- Signed URLs with expiration for screenshot access
- Role-based access control for storage buckets

## 👥 User Roles

### Employee
- Track time
- View personal screenshots
- Export personal reports

### Manager
- All employee features
- View team members' time entries
- Access team screenshots
- Team performance overview

### Admin
- Full system access
- User management
- Role assignment
- System-wide reporting

## 💻 Technical Stack

### Frontend
- React 18
- Vite
- TypeScript
- Tailwind CSS
- Zustand (State Management)
- React Router
- Lucide Icons

### Backend (Supabase)
- PostgreSQL
- Row Level Security
- Storage Buckets
- Real-time Subscriptions
- Authentication

## 📁 Project Structure

```
├── src/
│   ├── components/        # React components
│   ├── lib/              # Utilities and stores
│   └── main.tsx          # Application entry
├── supabase/
│   └── migrations/       # Database migrations
└── package.json
```

## 🙏 Acknowledgments

- [Supabase](https://supabase.com) for the backend infrastructure
- [React](https://reactjs.org/) for the UI framework
- [Tailwind CSS](https://tailwindcss.com) for styling
- [Lucide](https://lucide.dev) for icons
