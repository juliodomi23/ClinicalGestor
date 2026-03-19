FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Google Sign-In + Drive centralizado
ARG GOOGLE_CLIENT_ID=303856164144-86ob8fahvthq9vtq2nltadl7dl0romb0.apps.googleusercontent.com
ENV GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID

ARG GOOGLE_DRIVE_FOLDER_ID=1H4jFgK5JG9WZVT4xRtCxl0_GY6hPi9cN
ENV GOOGLE_DRIVE_FOLDER_ID=$GOOGLE_DRIVE_FOLDER_ID

EXPOSE 8001

CMD ["python", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
