# POC System

A modern, self-service platform for managing employee benefit plans with workflow lifecycle (versioning, approval, etc)

## 📚 Documentation

| Document | Purpose | Target Audience | When to Read |
|----------|---------|-----------------|--------------|
| [Executive Summary](docs/EXECUTIVE_SUMMARY.md) | Business overview, ROI, and strategic value | Executives, Stakeholders, Decision Makers | First overview of the system |
| [QuickStart Guide](docs/QUICKSTART.md) | Complete setup and installation instructions | Developers, System Administrators | Setting up the system |
| [RoadMap](docs/ROADMAP.md) | Project timeline, milestones, and future vision | Product Managers, Team Leads | Planning and tracking progress |
| [Architecture Guide](docs/ARCHITECTURE.md) | Technical design, principles, and decisions | Architects, Senior Developers | Understanding system design |
| [Implementation Guide](docs/IMPLEMENTATION_GUIDE.md) | Development patterns, APIs, and examples | Developers, Engineers | Building and extending features |

## 🎯 What is This?


**Key Benefits:**
- 🚀 **Self-Service**: Business users manage rules independently
- ⚡ **Real-Time**: Instant eligibility evaluation
- 🔒 **Compliant**: Full audit trail and version control
- 📊 **Scalable**: Microservices architecture for enterprise needs

## 🏗️ Project Structure

```
eligibility-poc/
├── docs/                           # Core documentation (6 documents)
├── middleware/                     # TypeScript API service
├── data/                          # Mock data API service
├── retool/                        # Retool UI configurations
├── scripts/                       # Automation and utilities
├── tests/                         # Test suites
├── docker-compose.yml             # Base services (no Retool)
└── docker-compose.self-hosted.yml # Complete stack with Retool
```

## ⚡ Quick Links

### For Developers
- 🚀 [Get Started Now](docs/QUICKSTART.md) - Set up in under 30 minutes
- 🔧 [API Documentation](docs/IMPLEMENTATION_GUIDE.md#api-documentation)
- 🐛 [Troubleshooting](docs/QUICKSTART.md#troubleshooting)

### For Business Users
- 📖 [User Guide](retool/USER_GUIDE.md) - How to use the system
- 🎯 [Feature Overview](docs/EXECUTIVE_SUMMARY.md#key-features)

### For Architects
- 🏛️ [System Design](docs/ARCHITECTURE.md)
- 🔄 [Integration Points](docs/IMPLEMENTATION_GUIDE.md#integration)

## 🖥️ Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Retool UI | http://localhost:3333 | User interface |
| Camunda | http://localhost:8080/camunda | Decision engine |
| Middleware API | http://localhost:3000 | Core API |
| Data API | http://localhost:3001 | External data |

## 📋 Prerequisites

- Docker Desktop 4.0+
- Node.js 16+ and npm 7+
- 8GB RAM minimum
- 10GB free disk space

For complete setup instructions, see the [QuickStart Guide](docs/QUICKSTART.md).

## 🤝 Support & Contact

- **Technical Issues**: Check [Implementation Guide](docs/IMPLEMENTATION_GUIDE.md)
- **Business Questions**: See [Executive Summary](docs/EXECUTIVE_SUMMARY.md)
- **Project Status**: Review [RoadMap](docs/ROADMAP.md)
- **Bug Reports**: Create an issue in the repository

## 📄 License

MIT License - See LICENSE file for details

---

**Ready to get started?** → [Follow the QuickStart Guide](docs/QUICKSTART.md)