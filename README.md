# RemoCloud - Modern Cloud File Storage MVP

A modern cloud file-storage platform built for developers with React, Node.js, and PostgreSQL.

## Features

- **Authentication**: Email/password for dashboard + API keys for programmatic access
- **File Storage**: Upload, download, and manage files in organized buckets
- **API Keys**: Generate and manage API keys with scoped permissions
- **Modern UI**: Responsive design with dark mode support
- **Developer-First**: Built with developers in mind with comprehensive API

## Tech Stack

### Frontend
- React 19.2.0 with functional components and hooks
- TanStack Query for server state management
- Tailwind CSS for styling with dark mode
- Framer Motion for animations
- Lucide React for icons
- React Router DOM for navigation

### Backend
- Node.js with Express.js
- PostgreSQL database
- JWT authentication
- bcrypt for password hashing
- Multer for file uploads

## Getting Started

### Prerequisites
- Node.js 16+ 
- PostgreSQL 12+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd remocloud
   ```

2. **Install dependencies**
   ```bash
   # Install frontend dependencies
   npm install
   
   # Install backend dependencies
   cd backend
   npm install
   
   # Install SDK dependencies
   cd ../sdk
   npm install
   ```

3. **Database Setup**
   ```bash
   # Create PostgreSQL database
   createdb remocloud
   
   # Copy environment file
   cd ../backend
   cp .env.example .env
   
   # Update .env with your database credentials
   ```

4. **Start the application**
   ```bash
   # Start backend (from backend directory)
   npm run dev
   
   # Start frontend (from root directory)
   npm start
   ```

### Environment Variables

Create a `.env` file in the `backend` directory:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=remocloud
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your-super-secret-jwt-key
PORT=5000
NODE_ENV=development
```

## API Documentation

### Authentication

#### Register
```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com", 
  "password": "password123"
}
```

### API Keys

#### Create API Key
```bash
POST /api/keys
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "My API Key",
  "scopes": ["read", "write"]
}
```

#### List API Keys
```bash
GET /api/keys
Authorization: Bearer <jwt_token>
```

### Buckets

#### Create Bucket
```bash
POST /api/buckets
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "name": "my-bucket",
  "is_public_by_default": false,
  "versioning_enabled": true
}
```

#### List Buckets
```bash
GET /api/buckets
Authorization: Bearer <api_key>
```

### Secure File Upload (3-Step Process)

#### Step 1: Initiate Upload
```bash
POST /api/buckets/<bucket_id>/uploads
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "filename": "document.pdf",
  "size": 1048576,
  "contentType": "application/pdf"
}

# Response:
{
  "uploadId": "upload_123",
  "signedUrl": "https://cdn.example.com/upload?signature=...",
  "headersToInclude": {
    "Content-Type": "application/pdf"
  },
  "expiresAt": "2024-01-01T12:00:00Z"
}
```

#### Step 2: Upload to Signed URL
```bash
PUT <signed_url>
Content-Type: application/pdf
Content-Length: 1048576

<file_data>
```

#### Step 3: Complete Upload
```bash
POST /api/uploads/<upload_id>/complete
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "etag": "d41d8cd98f00b204e9800998ecf8427e",
  "actualSize": 1048576
}
```

### Image Transforms

#### Transform Image with Parameters
```bash
GET /api/files/<file_id>/transform?w=300&h=300&q=85&format=webp
Authorization: Bearer <api_key>

# Response:
{
  "url": "https://cdn.example.com/derivative_abc123?expires=1640995200&signature=...",
  "derivative": {
    "id": "deriv_123",
    "width": 300,
    "height": 300,
    "format": "webp",
    "size": 15420,
    "mimeType": "image/webp"
  },
  "expiresAt": "2024-01-01T12:00:00Z",
  "transformSpec": {
    "w": 300,
    "h": 300,
    "q": 85,
    "format": "webp"
  }
}
```

#### Transform with Preset
```bash
GET /api/files/<file_id>/transform?preset=thumbnail
Authorization: Bearer <api_key>

# Available presets: thumbnail, small, medium, large, thumbnail-jpg, small-jpg, medium-jpg, large-jpg
```

#### Get Responsive Image Srcset
```bash
GET /api/files/<file_id>/srcset?breakpoints=300,600,900,1200&format=webp
Authorization: Bearer <api_key>

# Response:
{
  "srcset": "https://cdn.example.com/deriv1?... 300w, https://cdn.example.com/deriv2?... 600w, ...",
  "entries": [
    {
      "width": 300,
      "url": "https://cdn.example.com/deriv1?expires=1640995200&signature=...",
      "descriptor": "300w"
    }
  ],
  "sizes": "(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
}
```

#### Get Transform Presets
```bash
GET /api/transform/presets

# Response:
{
  "thumbnail": { "w": 150, "h": 150, "q": 80, "format": "webp" },
  "small": { "w": 300, "h": 300, "q": 85, "format": "webp" },
  "medium": { "w": 600, "h": 600, "q": 85, "format": "webp" },
  "large": { "w": 1200, "h": 1200, "q": 90, "format": "webp" }
}
```

### Secure File Access

#### Get Signed Download URL
```bash
POST /api/files/<file_id>/signed-url
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "expiry": 3600,
  "purpose": "download"
}

# Response:
{
  "url": "https://cdn.example.com/files/abc123?expires=1640995200&signature=...",
  "expiresAt": "2024-01-01T12:00:00Z",
  "isPublic": false,
  "cacheHeaders": {
    "Cache-Control": "private, max-age=900"
  }
}
```

#### Get Public URL (for public files)
```bash
GET /api/files/<file_id>/public-url

# Response:
{
  "url": "https://cdn.example.com/public/abc123",
  "isPublic": true,
  "cacheHeaders": {
    "Cache-Control": "public, max-age=31536000"
  }
}
```

### CDN Endpoints

#### Serve Private Files (with signature validation)
```bash
GET /cdn/<object_key>?expires=<timestamp>&signature=<hmac>&purpose=<purpose>
```

#### Serve Public Files
```bash
GET /cdn/public/<object_key>
```

### File Management

#### List Files with Filtering
```bash
GET /api/files?bucket_id=<bucket_id>&q=<search>&type=<mime_type>&sortBy=<field>&sortOrder=<ASC|DESC>&cursor=<cursor>&limit=<limit>
Authorization: Bearer <api_key>
```

#### Update File Metadata
```bash
PUT /api/files/<file_id>
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "original_name": "new-name.pdf",
  "is_public": true,
  "metadata_json": {
    "category": "documents",
    "tags": ["important", "work"]
  }
}
```

## Project Structure

```
remocloud/
├── backend/                 # Express.js API server
│   ├── middleware/         # Authentication middleware
│   ├── models/            # Database models
│   ├── routers/           # API route handlers
│   ├── uploads/           # File storage directory
│   └── server.js          # Main server file
├── src/                   # React frontend
│   ├── components/        # Reusable components
│   │   ├── layout/       # Layout components
│   │   └── ui/           # UI components
│   ├── pages/            # Page components
│   ├── services/         # API services
│   └── App.js            # Main app component
├── sdk/                  # Client SDK
└── public/               # Static assets
```

## Development

### Frontend Development
```bash
npm start                 # Start development server
npm run build            # Build for production
npm test                 # Run tests
```

### Backend Development
```bash
cd backend
npm run dev              # Start with nodemon
npm start                # Start production server
```

### Database Schema

The application automatically creates the following tables:
- `users` - User accounts
- `api_keys` - API key management
- `buckets` - File organization
- `files` - File metadata

## SDK Usage Examples

### Image Transforms

```javascript
const RemoCloudSDK = require('remocloud-sdk');
const sdk = new RemoCloudSDK('your-api-key');

// Get transformed image URL
const transformedImage = await sdk.getTransformedUrl('file-id', {
  w: 300,
  h: 300,
  q: 85,
  format: 'webp'
});

// Use preset
const thumbnail = await sdk.getTransformedUrl('file-id', {
  preset: 'thumbnail'
});

// Get responsive srcset
const srcset = await sdk.getSrcSet('file-id', {
  breakpoints: '300,600,900,1200',
  format: 'webp'
});

// Generate srcset string for HTML
const srcsetString = sdk.generateSrcSetString('file-id', [300, 600, 900, 1200], 'webp');

// Use in HTML
// <img src="fallback.jpg" srcset="${srcsetString}" sizes="(max-width: 600px) 100vw, 50vw" alt="Responsive image" />
```

### React Component Usage

```jsx
import ResponsiveImage from './components/ui/ResponsiveImage';
import ImageTransformModal from './components/ui/ImageTransformModal';

// Responsive image with automatic srcset
<ResponsiveImage
  fileId="file-id"
  alt="Description"
  className="w-full h-64 object-cover rounded-lg"
  breakpoints={[300, 600, 900, 1200]}
  format="webp"
  fallbackFormat="jpeg"
  sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
/>

// Transform modal for interactive editing
<ImageTransformModal
  file={selectedFile}
  isOpen={showTransformModal}
  onClose={() => setShowTransformModal(false)}
/>
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.