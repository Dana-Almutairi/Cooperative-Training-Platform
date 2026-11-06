
-- ==========================================
-- CoTrain Database Schema
-- Cooperative Training Platform
-- ==========================================


-- ==========================================
-- 1. Users
-- ==========================================

CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('student', 'company', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- 2. Companies
-- ==========================================

CREATE TABLE companies (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    industry VARCHAR(100),
    location VARCHAR(150),
    description TEXT,
    website VARCHAR(255),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
);


-- ==========================================
-- 3. Internships
-- ==========================================

CREATE TABLE internships (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    location VARCHAR(150),
    status VARCHAR(20) DEFAULT 'open'
        CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
);


-- ==========================================
-- 4. Reviews
-- ==========================================

CREATE TABLE reviews (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id INTEGER NOT NULL,
    company_id INTEGER NOT NULL,
    rating INTEGER NOT NULL
        CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id)
        REFERENCES users(id),

    FOREIGN KEY (company_id)
        REFERENCES companies(id),

    -- Prevent duplicate reviews
    CONSTRAINT unique_student_company_review
        UNIQUE (student_id, company_id)
);


-- ==========================================
-- 5. Applications
-- ==========================================

CREATE TABLE applications (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id INTEGER NOT NULL,
    internship_id INTEGER NOT NULL,

    status VARCHAR(20) DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'accepted',
                'rejected',
                'completed'
            )
        ),

    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id)
        REFERENCES users(id),

    FOREIGN KEY (internship_id)
        REFERENCES internships(id),

    UNIQUE (student_id, internship_id)
);


-- ==========================================
-- 6. Performance Indexes
-- ==========================================

-- Find internships belonging to a company
CREATE INDEX IF NOT EXISTS idx_internships_company_id
ON internships(company_id);

-- Find applications for an internship
CREATE INDEX IF NOT EXISTS idx_applications_internship_id
ON applications(internship_id);

-- Find reviews belonging to a company
CREATE INDEX IF NOT EXISTS idx_reviews_company_id
ON reviews(company_id);
