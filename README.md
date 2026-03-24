# Terraform vCenter VM Portal

A full-stack web application for automated VM provisioning on VMware vSphere infrastructure with an approval workflow, real-time progress tracking, and IP address management.

> **Note:** This is a sanitized version of a production tool that has successfully provisioned **40+ virtual machines** in an enterprise environment. All internal hostnames, IP addresses, and credentials have been replaced with example values.

---

## Problem Statement

In many organizations, provisioning virtual machines is a manual, time-consuming process:

- Infrastructure teams receive requests via email or tickets
- Engineers manually create VMs in vCenter, configure networking, and set up user access
- There's no visibility into request status or provisioning progress
- IP address allocation is tracked in spreadsheets, leading to conflicts
- No audit trail of who requested what and when

This portal solves all of these problems by providing a self-service interface with built-in approval workflows, automated provisioning via Terraform, and real-time progress tracking via WebSockets.

---

## Architecture

<!-- TODO: Add architecture diagram image -->
<!-- ![Architecture Diagram](docs/architecture.png) -->

The system consists of three main layers:

```
┌─────────────────────────────────────────────────────┐
│              Frontend (React + TypeScript)           │
│         Tailwind CSS · React Query · WebSocket       │
└──────────────┬──────────────────────┬───────────────┘
               │ REST API             │ WebSocket
┌──────────────▼──────────────────────▼───────────────┐
│              Backend (Rust + Axum)                    │
│    JWT Auth · RBAC · Terraform · SSH Verification    │
└──────────────┬──────────────────────┬───────────────┘
               │ SQL                  │ Terraform CLI
┌──────────────▼─────────┐ ┌─────────▼───────────────┐
│    PostgreSQL Database  │ │   VMware vSphere/vCenter │
│  Users · Requests · IPs │ │   VM Creation & Config   │
└─────────────────────────┘ └─────────────────────────┘
```

---

## Features

- **Role-Based Access Control** — Admin, Approver, and Requester roles with enforced permissions
- **VM Request Workflow** — Create requests with multiple VMs, review/approve/reject with notes
- **Automated Provisioning** — Terraform generates and applies infrastructure-as-code for each request
- **Real-Time Progress** — WebSocket-based live updates during VM provisioning and deletion
- **IP Address Management** — Pool-based IP allocation with conflict prevention
- **Network Management** — VLAN configuration with gateway and DNS settings
- **SSH Verification** — Automated connectivity checks after VM creation with retry logic
- **Encrypted Credentials** — AES-GCM encryption for sensitive data at rest
- **VM Lifecycle Management** — Provision, monitor, and delete VMs with full audit trail
- **Cloud-Init Integration** — Automated user setup with SSH key deployment

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Rust, Axum, Tokio, SQLx |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **Database** | PostgreSQL 16 |
| **Infrastructure** | Terraform, VMware vSphere |
| **Auth** | JWT (jsonwebtoken), Argon2 password hashing |
| **Real-time** | WebSockets (tokio-tungstenite) |
| **Encryption** | AES-GCM (aes-gcm crate) |

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── main.rs                 # Entry point, server setup, admin seeding
│   │   ├── lib.rs                  # Library exports, AppState definition
│   │   ├── config.rs               # Environment configuration loading
│   │   ├── db.rs                   # Database connection pool
│   │   ├── error.rs                # Error types and handling
│   │   ├── handlers/
│   │   │   ├── auth.rs             # Login, user management endpoints
│   │   │   ├── vm_requests.rs      # VM request CRUD, review workflow
│   │   │   ├── terraform.rs        # Terraform config generation & execution
│   │   │   ├── websocket.rs        # WebSocket endpoints for progress
│   │   │   ├── provisioned_vms.rs  # Provisioned VM management
│   │   │   ├── networks.rs         # Network/VLAN management
│   │   │   ├── os_templates.rs     # OS template listing
│   │   │   └── ip_addresses.rs     # IP pool management
│   │   ├── models/                 # Data structures (User, VmRequest, etc.)
│   │   ├── services/
│   │   │   ├── provisioning.rs     # Terraform-based VM provisioning
│   │   │   ├── deletion.rs         # VM deletion workflow
│   │   │   ├── progress_broadcaster.rs  # Real-time progress via broadcast channels
│   │   │   └── ssh_checker.rs      # Post-provision SSH verification
│   │   ├── middleware/             # JWT auth middleware
│   │   └── utils/                  # Encryption, JWT, password hashing
│   ├── migrations/                 # PostgreSQL schema migrations (SQLx)
│   └── scripts/                    # Example data import scripts
├── frontend/
│   ├── src/
│   │   ├── pages/                  # Dashboard, VmRequests, Users, Networks, etc.
│   │   ├── components/             # Reusable UI components
│   │   ├── hooks/                  # Custom hooks (auth, WebSocket progress)
│   │   ├── contexts/               # React Context (AuthContext)
│   │   ├── api/                    # API client modules
│   │   └── types/                  # TypeScript type definitions
│   └── ...
├── deploy/                         # Production deployment configs
│   ├── deploy.sh                   # Deployment script (Debian/Ubuntu)
│   ├── nginx-vm-portal.conf        # Nginx reverse proxy config
│   ├── vm-portal-backend.service   # Systemd service file
│   └── .env.production             # Production env template
└── docker-compose.yml              # PostgreSQL for local development
```

---

## Prerequisites

- **Rust** (1.75+ recommended) — [Install](https://rustup.rs/)
- **Node.js** (18+) and npm — [Install](https://nodejs.org/)
- **PostgreSQL** (16 recommended) — via Docker or native install
- **Terraform** (1.5+) — [Install](https://developer.hashicorp.com/terraform/downloads)
- **VMware vSphere/vCenter** — with API access and VM templates prepared
- **GoVC** (optional) — VMware CLI for template management

---

## Setup

### 1. Database

Start PostgreSQL using Docker:

```bash
docker-compose up -d
```

This creates a local PostgreSQL instance on port 5432. Migrations run automatically when the backend starts.

### 2. Backend

```bash
cd backend

# Copy the example environment file
cp .env.example .env

# Edit .env with your vSphere credentials and configuration
# At minimum, set: DATABASE_URL, JWT_SECRET, VSPHERE_SERVER, VSPHERE_USER, VSPHERE_PASSWORD

# Build and run
cargo run
```

The backend starts on `http://localhost:3000` by default.

**Default admin credentials** (created on first startup):
- Email: `admin@example.com`
- Password: `Admin123!`

### 3. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server (proxies API to backend)
npm run dev
```

The frontend dev server starts on `http://localhost:5173` and proxies `/api` requests to the backend.

### 4. vSphere Templates

Prepare VM templates in your vCenter that match the template mappings in `.env`:

- `ubuntu-22.04-template`
- `ubuntu-20.04-template`
- `debian-12-template`
- `centos-stream-9-template`
- `rhel-9-template`
- `windows-server-2022-template`
- `windows-server-2019-template`

Templates should have VMware Tools installed and cloud-init configured (for Linux templates).

---

## Usage

### Creating a VM Request

1. Log in as a Requester (or Admin)
2. Navigate to **New VM Request**
3. Fill in the request title and add one or more VM configurations:
   - VM name, CPU cores, RAM, storage
   - Select OS template and network
   - Choose an available IP address from the pool
   - Set the VM username and password
4. Submit the request for approval

### Approving Requests

1. Log in as an Approver or Admin
2. Navigate to **VM Requests** and select a pending request
3. Review the VM specifications
4. Approve, reject, or request modifications (with notes)

### Provisioning

Once approved, an Admin can trigger provisioning:

1. The system generates Terraform configuration files
2. Terraform applies the configuration against vCenter
3. Real-time progress is streamed via WebSocket:
   - Initializing → Creating VM → Configuring Network → Setting up User → Verifying SSH → Completed
4. SSH connectivity is verified automatically with retry logic

### Managing Provisioned VMs

- View all provisioned VMs with their status
- Delete VMs with real-time progress tracking (Terraform destroy)
- IP addresses are automatically released back to the pool

---

## Production Deployment

See the `deploy/` directory for production deployment configurations:

- `deploy.sh` — Automated deployment script for Debian/Ubuntu
- `nginx-vm-portal.conf` — Nginx reverse proxy configuration
- `vm-portal-backend.service` — Systemd service file
- `.env.production` — Production environment template

---

## Screenshots

<!-- TODO: Add screenshots -->
<!--
![Dashboard](docs/screenshots/dashboard.png)
![New VM Request](docs/screenshots/new-request.png)
![Provisioning Progress](docs/screenshots/provisioning.png)
![Provisioned VMs](docs/screenshots/provisioned-vms.png)
-->

*Screenshots coming soon*

---

## License

This project is provided for educational and portfolio purposes.
