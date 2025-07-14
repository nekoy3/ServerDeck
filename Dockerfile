FROM python:3.9-bullseye

WORKDIR /app

# Install build-essential for compiling Python packages like PyNaCl
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip uninstall -y paramiko cryptography && pip cache purge && pip install --no-cache-dir --upgrade -r requirements.txt

# Install Node.js and npm for xterm.js
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install xterm.js and xterm-addon-fit
RUN npm install xterm @xterm/addon-fit

# Create static directories
RUN mkdir -p static/js static/css

# Copy xterm.js and its addon to static directory
RUN cp node_modules/xterm/lib/xterm.js static/js/xterm.js \
    && cp node_modules/xterm/css/xterm.css static/css/xterm.css \
    && cp node_modules/@xterm/addon-fit/lib/addon-fit.js static/js/addon-fit.js

COPY . .

EXPOSE 5001

CMD ["python3", "app.py"]