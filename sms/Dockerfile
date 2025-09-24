FROM python:3.11-slim
WORKDIR /sms
RUN apt-get update && apt-get install -y \
    gcc \
    dos2unix \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN dos2unix start.sh && \
    chmod +x start.sh
EXPOSE 6379
CMD ["./start.sh"]