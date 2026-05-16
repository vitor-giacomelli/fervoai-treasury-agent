# Vultr Deployment Runbook (Ubuntu 24.04 LTS)

This runbook provisions Docker + Docker Compose, clones the repo, sets environment variables, and starts the stack.

## 1) Update system and install Docker + Compose plugin

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
```

Log out and back in once after the `usermod` command, then continue.

## 2) Clone repository

```bash
cd ~
git clone <YOUR_REPO_URL> fervoai-treasury-agent
cd fervoai-treasury-agent
```

## 3) Create root `.env` file for backend variables

```bash
cat > .env << 'EOF'
GEMINI_API_KEY=your_gemini_api_key_here
# Optional fallback key:
# GOOGLE_API_KEY=your_google_api_key_here

# For local/live testing you can set FALSE.
# For bulletproof stage runs keep TRUE or omit (compose defaults to TRUE).
DEMO_MODE=TRUE
EOF
```

## 4) Build and run

```bash
docker compose up -d --build
docker compose ps
```

## 5) Verify

```bash
curl -I http://localhost
curl -s http://localhost:8000/health
curl -N "http://localhost/api/stream_workflow?query=start"
```

Frontend will be available on:
- `http://<VULTR_PUBLIC_IP>/`

