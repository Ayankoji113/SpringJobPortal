# Spring Job Portal

A modern, full-stack Job Portal application built using **Spring Boot** (Backend) and **React/Vite** (Frontend). 

This platform connects job seekers with employers, offering a seamless experience for posting jobs, managing applications, real-time notifications, and direct messaging between users.

## 🚀 Features

### For Job Seekers:
- **User Authentication**: Secure signup and login using JWT.
- **Profile Management**: Update your bio, skills, resume, and profile photo.
- **Job Search & Filtering**: Browse and search for jobs based on title, location, and type.
- **Job Applications**: Apply to jobs with a customized cover letter.
- **My Applications**: Track the status of your applications (Pending, Reviewed, Accepted, Rejected).
- **Saved Jobs**: Bookmark jobs to apply for them later.
- **AI Tools**: AI-assisted resume review and cover letter generation.

### For Employers:
- **Company Profile**: Create and manage company details.
- **Post Jobs**: Create job postings with detailed descriptions and requirements.
- **Manage Applications**: View applications submitted for your job postings, download resumes, and update application statuses.
- **Employer Dashboard**: View stats on total jobs posted and applications received.

### Platform Features:
- **Real-time Messaging**: Direct messaging between employers and candidates.
- **Notifications**: Real-time alerts for application updates and new messages.
- **Admin Dashboard**: Platform overview and user/job management capabilities.

---

## 🛠️ Tech Stack

### Backend
- **Framework**: Spring Boot 3.4
- **Security**: Spring Security & JWT (JSON Web Tokens)
- **Database**: PostgreSQL with Spring Data JPA
- **API Documentation**: Swagger/OpenAPI 3
- **File Storage**: Local File Storage for Resumes & Profile Photos
- **Real-time**: Spring Boot WebSockets
- **Other**: Lombok, Validation, AOP (Aspect-Oriented Programming)

### Frontend
- **Framework**: React 19 (via Vite)
- **Routing**: React Router DOM
- **Icons**: Lucide React
- **Styling**: Modern CSS / Tailwind (if applicable)
- **HTTP Client**: Axios

---

## ⚙️ Local Development Setup

### Prerequisites
- **Java 21** or higher
- **Node.js** (v18+)
- **PostgreSQL** (Running locally)
- **Maven** (Optional, project includes Maven wrapper)

### 1. Database Configuration
Create a PostgreSQL database for the application (e.g., `jobportal_db`).

Update the `application.properties` (or `application.yml`) in `src/main/resources`:
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/jobportal_db
spring.datasource.username=your_postgres_username
spring.datasource.password=your_postgres_password
```

### 2. Running the Backend (Spring Boot)
Open a terminal in the root directory and run:

**Using Maven Wrapper (Windows):**
```cmd
mvnw.cmd spring-boot:run
```

**Using Maven Wrapper (Mac/Linux):**
```bash
./mvnw spring-boot:run
```
*The backend server will start on `http://localhost:8080`*

### 3. Running the Frontend (React/Vite)
Open a new terminal and navigate to the frontend directory:
```cmd
cd src/main/frontend
```

Install dependencies:
```cmd
npm install
```

Start the development server:
```cmd
npm run dev
```
*The frontend application will run on `http://localhost:5173`*

---

## 📚 API Documentation
Once the backend is running, you can access the interactive Swagger API documentation at:
**`http://localhost:8080/swagger-ui/index.html`**

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! 

## 📝 License
This project is open-source and available under the MIT License.
