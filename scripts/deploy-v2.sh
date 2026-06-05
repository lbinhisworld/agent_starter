#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Smart CTO v2 独立部署脚本
# 用法：sudo bash scripts/deploy-v2.sh
# ============================================================

# ---------- 配置区 ----------
DEPLOY_DIR="/qiqiao/do1_smart_cto_v2"
APP_PORT=3099
DB_NAME="do1_smart_cto_v2"
DB_USER="smart_cto_v2_app"
DB_PASS=""               # 留空则自动生成
JWT_SECRET=""            # 留空则自动生成
PM2_NAME="smart-cto-v2"

GIT_REPO="https://git.qiweioa.com.cn/liuhaitao/do1_smart_cto.git"
GIT_BRANCH="feat/simplify-customer-detail-page"

NGINX_CONF="/etc/nginx/conf.d/smart-cto-v2.conf"
# ---------- 配置区结束 ----------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
WARN=0
FAIL=0

log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((PASS++)); }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; ((WARN++)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((FAIL++)); }

generate_password() {
  openssl rand -base64 24 | tr -d '/+=' | head -c 32
}

echo "========================================="
echo " Smart CTO v2 独立部署"
echo "========================================="
echo ""

# ========== 预检测 ==========

echo "--- 1. 基础软件 ---"
for cmd in git curl nginx mysql node npx pm2; do
  if command -v "$cmd" &>/dev/null; then
    log_pass "$cmd 已安装"
  else
    log_fail "$cmd 未安装"
  fi
done

NODE_VER=$(node -v 2>/dev/null || echo "v0")
NODE_MAJOR=${NODE_VER#v}; NODE_MAJOR=${NODE_MAJOR%%.*}
if [[ "$NODE_MAJOR" -ge 20 ]]; then
  log_pass "Node.js $NODE_VER"
else
  log_fail "Node.js $NODE_VER < 20，需升级"
fi

echo ""
echo "--- 2. 端口检测 ---"
echo "扫描所有监听端口..."
ALL_LISTEN=$(ss -tlnp 2>/dev/null | awk 'NR>1 {split($4,a,":"); print a[length(a)]}' | sort -n | uniq)

if lsof -i :"$APP_PORT" -sTCP:LISTEN &>/dev/null; then
  PID=$(lsof -i :"$APP_PORT" -t -sTCP:LISTEN 2>/dev/null | head -1)
  PROC=$(ps -p "$PID" -o args= 2>/dev/null | cut -c1-80 || echo "未知")
  log_fail "端口 $APP_PORT 已被占用 (PID=$PID): $PROC"
else
  log_pass "端口 $APP_PORT 可用"
fi

echo ""
echo "当前所有监听端口："
printf "  %-8s %-8s %s\n" "端口" "PID" "进程"
printf "  %-8s %-8s %s\n" "----" "---" "----"
while IFS= read -r port; do
  [[ -z "$port" ]] && continue
  PID=$(lsof -i :"$port" -t -sTCP:LISTEN 2>/dev/null | head -1 || echo "?")
  PROC=$(ps -p "$PID" -o comm= 2>/dev/null || echo "未知")
  printf "  %-8s %-8s %s\n" "$port" "$PID" "$PROC"
done <<< "$ALL_LISTEN"

echo ""
echo "--- 3. 数据库连接 ---"
if mysql -u root -e "SELECT 1;" &>/dev/null; then
  log_pass "MySQL root 可连接"
else
  log_fail "MySQL root 无法连接（可能需要 sudo）"
fi

echo ""
echo "--- 4. 磁盘空间 ---"
AVAILABLE_GB=$(df -BG /qiqiao 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'G')
if [[ -z "$AVAILABLE_GB" ]]; then
  AVAILABLE_GB=$(df -BG / | tail -1 | awk '{print $4}' | tr -d 'G')
fi
if [[ "$AVAILABLE_GB" -ge 5 ]]; then
  log_pass "可用空间 ${AVAILABLE_GB}GB"
else
  log_warn "可用空间仅 ${AVAILABLE_GB}GB，建议 >= 5GB"
fi

# ========== 汇总 ==========
echo ""
echo "========================================="
echo -e " ${GREEN}$PASS 通过${NC}，${YELLOW}$WARN 警告${NC}，${RED}$FAIL 失败${NC}"
echo "========================================="

if [[ $FAIL -gt 0 ]]; then
  echo -e "${RED}有失败项，请先解决！${NC}"
  exit 1
fi

echo ""
read -rp "继续部署？[y/N] " -n 1 -r
echo ""
[[ ! $REPLY =~ ^[Yy]$ ]] && { echo "已取消"; exit 0; }

# ============================================================
# 部署步骤
# ============================================================

echo ""
echo "========================================="
echo " 开始部署"
echo "========================================="

# 生成密码
[[ -z "$DB_PASS" ]] && { DB_PASS=$(generate_password); echo "数据库密码: $DB_PASS"; }
[[ -z "$JWT_SECRET" ]] && JWT_SECRET=$(generate_password)

# ---- 1. 创建目录 + 拉代码 ----
echo ""
echo "[1/6] 创建目录 + 拉取代码..."
sudo mkdir -p "$DEPLOY_DIR"
sudo chown -R "$USER:$USER" "$DEPLOY_DIR"

if [[ -d "$DEPLOY_DIR/.git" ]]; then
  cd "$DEPLOY_DIR"
  git fetch origin
  git checkout "$GIT_BRANCH"
  git pull origin "$GIT_BRANCH"
else
  git clone -b "$GIT_BRANCH" "$GIT_REPO" "$DEPLOY_DIR"
fi

cd "$DEPLOY_DIR"
echo "分支: $(git branch --show-current)  提交: $(git log --oneline -1)"

# ---- 2. 创建数据库 ----
echo ""
echo "[2/6] 创建数据库..."
sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
echo "数据库 $DB_NAME 就绪"

# ---- 3. 配置后端 ----
echo ""
echo "[3/6] 配置后端 .env..."
cd "$DEPLOY_DIR/backend"

cat > .env <<EOF
NODE_ENV=production
HOST=0.0.0.0
PORT=$APP_PORT
DATABASE_URL=mysql://$DB_USER:$DB_PASS@127.0.0.1:3306/$DB_NAME
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=30d
EOF

# ---- 4. 安装依赖 + 构建 ----
echo ""
echo "[4/6] 安装依赖 + 建表 + 构建..."
npm ci
npx prisma generate
npx prisma db push
npm run build

# ---- 5. PM2 启动 ----
echo ""
echo "[5/6] PM2 启动后端..."

if pm2 describe "$PM2_NAME" &>/dev/null; then
  pm2 stop "$PM2_NAME" || true
  pm2 delete "$PM2_NAME" || true
fi

pm2 start npm --name "$PM2_NAME" -- start
pm2 save

echo "等待启动..."
sleep 5

HEALTH=$(curl -sf "http://127.0.0.1:$APP_PORT/health" 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q '"ok":true'; then
  echo -e "${GREEN}[PASS]${NC} 后端健康检查通过 :$APP_PORT"
else
  echo -e "${RED}[FAIL]${NC} 后端启动失败，查看日志: pm2 logs $PM2_NAME"
  echo "响应: $HEALTH"
  exit 1
fi

# ---- 6. Nginx ----
echo ""
echo "[6/6] 配置 Nginx..."

sudo tee "$NGINX_CONF" > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    root $DEPLOY_DIR/frontend;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:$APP_PORT/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:$APP_PORT/health;
    }
}
EOF

# 写入前端配置
cat > "$DEPLOY_DIR/frontend/config.local.js" <<'EOFJS'
window.APP_CONFIG = window.APP_CONFIG || {};
window.APP_CONFIG.MODE = 'online';
window.APP_CONFIG.BACKEND_API_URL = '/api';
EOFJS

if sudo nginx -t 2>&1; then
  sudo systemctl reload nginx
  echo -e "${GREEN}[PASS]${NC} Nginx 已重载"
else
  echo -e "${RED}[FAIL]${NC} Nginx 配置有误"
  exit 1
fi

# ---- 完成 ----
echo ""
echo "========================================="
echo -e " ${GREEN}部署完成！${NC}"
echo "========================================="
echo ""
echo "访问: http://<服务器IP>/"
echo "管理: root / root（首次登录后请改密码）"
echo ""
echo "接下来需要配置 AI（需先登录拿 Token）："
echo ""
echo "  # 1. 登录"
echo "  TOKEN=\$(curl -s -X POST http://127.0.0.1:$APP_PORT/api/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"username\":\"root\",\"password\":\"root\"}' \\"
echo "    | python3 -c \"import sys,json; print(json.load(sys.stdin).get('token',''))\")"
echo ""
echo "  # 2. 写入 AI 配置"
echo "  curl -X PUT http://127.0.0.1:$APP_PORT/api/ai/config \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H \"Authorization: Bearer \$TOKEN\" \\"
echo "    -d '{"
echo "      \"apiKey\": \"你的DeepSeek Key\","
echo "      \"apiUrl\": \"https://api.deepseek.com/v1/chat/completions\","
echo "      \"model\": \"deepseek-v4-flash\""
echo "    }'"
echo ""
echo "日常运维："
echo "  日志:   pm2 logs $PM2_NAME"
echo "  重启:   pm2 restart $PM2_NAME"
echo "  更新:   cd $DEPLOY_DIR && git pull && cd backend && npm ci && npm run build && pm2 restart $PM2_NAME"
echo ""
echo "数据库: mysql -u $DB_USER -p -h 127.0.0.1 $DB_NAME"
echo "后端配置: $DEPLOY_DIR/backend/.env"
echo "前端配置: $DEPLOY_DIR/frontend/config.local.js"
echo "Nginx: $NGINX_CONF"
