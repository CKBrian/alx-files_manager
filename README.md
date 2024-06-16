# Files Manager

This project is a summary of this back-end trimester covering various concepts and technologies such as authentication, NodeJS, MongoDB, Redis, pagination, and background processing. The objective is to build a simple platform to upload and view files.

## Features

- **User Authentication**: Authenticate users via a token.
- **File Management**:
  - List all files.
  - Upload a new file.
  - Change permissions of a file.
  - View a file.
  - Generate thumbnails for images.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Technologies Used](#technologies-used)
- [Authors](#authors)
- [License](#license)

## :wrench: Installation

1. **Clone the repository**:
   ```sh
   git clone https://github.com/your-username/files-manager.git
   cd files-manager

## Usage

```sh
npm install
```

## :wrench: API Endpoints  

- **List all files**: `GET /api/files`
- **Upload a new file**: `POST /api/files`
- **Change permissions of a file**: `PATCH /api/files/:id`
- **View a file**: `GET /api/files/:id`
- **Generate thumbnails for images**: `GET /api/files/thumbnails/:id`   

## :wrench: Project Structure

```sh
├── README.md
```
## Technologies Used

## Authors

## License