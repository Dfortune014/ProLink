// Merged skills from tech_skills.json and all_skills.json
// This file contains all unique skills for autocomplete suggestions

export const ALL_SKILLS = [
  // From tech_skills.json - Cloud Engineering
  "AWS", "Azure", "Google Cloud Platform", "Cloud Architecture", "Cloud Security",
  "Cloud Networking", "Cloud Monitoring", "CloudFormation", "Terraform", "Pulumi",
  "AWS Lambda", "API Gateway", "S3", "DynamoDB", "EC2", "ECS", "EKS",
  "Azure Functions", "Azure DevOps", "Azure Virtual Machines", "Azure Blob Storage",
  "Azure Cosmos DB", "Azure AD", "Azure Key Vault", "GCP Cloud Run", "Firestore",
  "Cloud Pub/Sub", "Cloud SQL", "Cloud Storage", "Load Balancers", "Auto Scaling",
  "Route 53", "VPC", "IAM", "CloudWatch", "KMS", "Secrets Manager", "SSO/SAML",
  "CloudFront", "Elastic Beanstalk", "Serverless Framework", "OpenSearch",
  "Reverse Proxies", "CDN Management",
  
  // From tech_skills.json - DevOps
  "Docker", "Kubernetes", "Helm", "CI/CD", "GitHub Actions", "GitLab CI", "Jenkins",
  "ArgoCD", "FluxCD", "Linux", "Bash Scripting", "Monitoring", "Prometheus", "Grafana",
  "ELK Stack", "Logstash", "Filebeat", "Ansible", "Puppet", "Chef", "Nginx", "Apache",
  "Systemd", "Networking", "BGP", "DNS", "SSH", "Load Balancing", "Reverse Proxying",
  "Terraform Modules", "Infrastructure as Code", "Packer", "Container Security",
  "Istio", "Kong API Gateway", "Traefik", "Vault", "Consul", "Service Mesh", "GitOps",
  "Hypervisor / Virtual Machines", "VMware", "OpenStack",
  
  // From tech_skills.json - Software Engineering
  "Java", "Python", "JavaScript", "TypeScript", "Go", "C++", "C", "C#", "Ruby", "PHP",
  "Rust", "Kotlin", "Swift", "R", "SQL", "NoSQL", "HTML", "CSS", "React", "Next.js",
  "Node.js", "Express", "Django", "Flask", "FastAPI", "Spring Boot", "Hibernate",
  "Ruby on Rails", "Angular", "Vue.js", "Svelte", "GraphQL", "Apollo", "REST API Design",
  "Microservices", "MQTT", "WebSockets", "Event-Driven Architecture", "Unit Testing",
  "Integration Testing", "TDD", "Jest", "Mocha", "JUnit", "PyTest", "Cypress", "Vitest",
  "Version Control (Git)", "Design Patterns", "Distributed Systems", "Concurrency",
  "Authentication (OAuth2, JWT)", "Web Security", "Caching (Redis, Memcached)",
  "Queues (SQS, RabbitMQ, Kafka)", "API Rate Limiting", "Performance Optimization",
  
  // From tech_skills.json - Mobile Development
  "React Native", "Flutter", "SwiftUI", "Kotlin Android", "Jetpack Compose",
  "iOS Development", "Android Development", "Firebase", "Push Notifications",
  "Mobile UI/UX", "Deep Linking", "App Store Release", "Play Store Deployment",
  "Mobile Analytics", "Mobile Security",
  
  // From tech_skills.json - AI/ML
  "Machine Learning", "Deep Learning", "Neural Networks", "TensorFlow", "PyTorch",
  "Keras", "Scikit-Learn", "Computer Vision", "NLP", "LLM Fine-Tuning",
  "RAG (Retrieval-Augmented Generation)", "LangChain", "Hugging Face Transformers",
  "Model Deployment", "ONNX", "MLOps", "Model Monitoring", "Data Labeling",
  "Feature Engineering", "Pandas", "NumPy", "SciPy", "Matplotlib", "Jupyter Notebooks",
  "CNNs", "RNNs", "LSTMs", "Generative AI", "Prompt Engineering", "Model Optimization",
  "GPU Computing", "OpenCV", "Sentiment Analysis", "Reinforcement Learning", "AI Ethics",
  
  // From tech_skills.json - Data Engineering
  "ETL Pipelines", "Data Warehousing", "Data Modeling", "BigQuery", "Redshift",
  "Snowflake", "Databricks", "Apache Spark", "Airflow", "Prefect", "Kafka", "Kinesis",
  "DynamoDB Streams", "dbt", "Data Lakes", "Parquet", "Athena", "S3 Lakehouse",
  "Delta Lake", "Data Governance", "Data Quality", "Streaming Data", "Batch Workflows",
  "Data APIs", "Metadata Management",
  
  // From tech_skills.json - Cybersecurity
  "Network Security", "Cloud Security", "Zero Trust", "SIEM", "SOC Operations",
  "Threat Detection", "Incident Response", "OWASP Top 10", "Burp Suite", "Metasploit",
  "Vulnerability Scanning", "Nessus", "Penetration Testing", "Firewalls", "Encryption",
  "SSL/TLS", "SSH Hardening", "Log Analysis", "Security Monitoring", "Forensics",
  "Identity Governance", "Compliance (HIPAA, SOC2, GDPR)", "Endpoint Security",
  "Threat Modeling", "API Security", "SAST", "DAST", "WAF Management", "Secure SDLC",
  
  // From tech_skills.json - UI/UX/Product
  "Wireframing", "Prototyping", "Figma", "Sketch", "Adobe XD", "User Research",
  "Accessibility (A11y)", "Product Strategy", "User Flows", "Journey Mapping",
  "UI Design", "Design Systems", "Branding", "Animation", "Information Architecture",
  "Visual Design", "Usability Testing", "Content Strategy",
  
  // From tech_skills.json - Business/Professional
  "Communication", "Technical Writing", "Project Management", "Agreme/Scrum",
  "Collaboration", "Leadership", "Time Management", "Problem Solving", "Critical Thinking",
  "Documentation", "Public Speaking", "Mentoring", "Stakeholder Management",
  "Requirements Analysis", "Presentation Skills", "Teamwork", "Adaptability",
  "Customer Focus", "Product Thinking",
  
  // From tech_skills.json - Soft Skills
  "Creativity", "Accountability", "Work Ethic", "Attention to Detail", "Empathy",
  "Decision Making", "Curiosity", "Consistency", "Analytical Thinking",
  "Resourcefulness", "Self-Motivation",
  
  // From all_skills.json - Technology (additional)
  "Cloud Computing", "Google Cloud", "APIs", "Frontend Development", "Backend Development",
  "Databases", "AI Model Deployment", "DevOps", "Scripting (Python, Bash)",
  
  // From all_skills.json - Healthcare
  "Electronic Health Records (EHR)", "Telemedicine", "AI-Assisted Diagnostics",
  "Specialized Patient Care", "Emergency Medicine", "Trauma Care", "Orthopedic Care",
  "Mental Health Support", "PTSD Support", "Cultural Competence", "Health Education",
  "Quality Improvement", "Resilience", "Stress Management", "Continuous Learning",
  "Patient Communication", "Care Coordination",
  
  // From all_skills.json - Healthcare Soft Skills
  "Compassion", "Active Listening", "Flexibility", "Professionalism", "Emotional Intelligence",
  
  // From all_skills.json - Retail
  "Customer Service", "Cash Handling", "POS Operation", "Inventory Management",
  "Visual Merchandising", "Product Knowledge", "Retail Sales Techniques", "Loss Prevention",
  "Basic Math", "Digital POS Systems", "E-commerce Tools", "Social Media Marketing",
  "CRM Tools", "Store Operations", "Stock Management", "Store Display Design",
  
  // From all_skills.json - Retail Soft Skills
  "Patience", "Conflict Resolution",
  
  // From all_skills.json - Fashion Retail
  "Fashion Trend Awareness", "Garment Care Knowledge", "Personal Styling",
  "Color Coordination", "Fashion Product Knowledge",
  
  // From all_skills.json - Electronics Retail
  "Technical Product Knowledge", "Troubleshooting", "Software Installation",
  "Device Setup Assistance",
  
  // From all_skills.json - Grocery Retail
  "Food Safety", "Nutrition Knowledge", "Fresh Produce Management", "Stock Rotation",
  "Expiration Management",
  
  // From all_skills.json - Luxury Retail
  "VIP Service", "High-End Product Knowledge", "Cultural Awareness", "Luxury Storytelling",
  "Upselling Premium Products",
  
  // From all_skills.json - Human Resources
  "Recruiting", "HRIS Systems", "Applicant Tracking Systems", "Payroll Processing",
  "Labor Law Knowledge", "Employment Law", "Employee Relations", "Onboarding",
  "Benefits Administration", "Training & Development", "Performance Management",
  "HR Compliance",
  
  // From all_skills.json - Marketing
  "Marketing Strategy", "Digital Marketing", "Content Marketing", "SEO", "SEM",
  "Brand Management", "Copywriting", "Video Marketing", "Email Marketing",
  "Google Analytics", "Google Ads", "Product Marketing", "Campaign Management",
  "Creative Direction", "Market Research",
  
  // From all_skills.json - Sales
  "Lead Generation", "Sales Prospecting", "B2B Sales", "B2C Sales", "Needs Qualification",
  "Sales Presentations", "Closing Techniques", "CRM Management", "Account Management",
  "Outbound Sales", "Inbound Sales", "Cold Calling", "Negotiation", "Retail Sales",
  "Salesforce CRM", "HubSpot CRM",
  
  // From all_skills.json - Finance
  "Financial Analysis", "Financial Modeling", "Accounting", "Budgeting", "Risk Management",
  "Lending", "Banking Operations", "Procurement", "Forecasting", "GAAP Knowledge",
  "Tableau", "Power BI", "Excel Advanced Functions", "Business Development",
  "Audit Preparation", "Tax Preparation",
  
  // From all_skills.json - Customer Service
  "Call Center Etiquette", "Front Desk Operations", "Hospitality", "Computer Literacy",
  "Order Processing", "Phone Handling", "Email Support", "Live Chat Support",
  "CRM Ticketing Systems",
  
  // From all_skills.json - Administrative
  "Microsoft Office", "Data Entry", "Typing", "Calendar Management", "Email Management",
  "Front Desk Management", "Office Management", "Scheduling", "Document Filing",
  "Travel Arrangements", "Meeting Coordination",
  
  // From all_skills.json - Education
  "Classroom Management", "Lesson Planning", "Instructional Design", "Curriculum Development",
  "Special Education Knowledge", "Tutoring", "Child Development", "Behavior Management",
  "Bilingual Education",
  
  // From all_skills.json - Manufacturing
  "Machine Operation", "Robotics Operation", "Forklift Operation", "GMP Compliance",
  "Continuous Improvement", "Hand Tool Proficiency", "Quality Assurance",
  "Safety Standards Compliance", "Industrial Machinery Use",
  
  // From all_skills.json - Hospitality
  "Multitasking", "Food Service", "Bartending", "Concierge Services", "Housekeeping",
  "Event Coordination", "Reservations Management", "Guest Relations", "Workflow Management",
  
  // From all_skills.json - Hospitality Soft Skills
  "Language Skills",
]
  .filter((skill, index, self) => self.indexOf(skill) === index) // Remove duplicates
  .sort((a, b) => a.localeCompare(b)); // Sort alphabetically

