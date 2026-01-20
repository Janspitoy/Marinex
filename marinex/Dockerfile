FROM python:3.10

WORKDIR /app

COPY requirements.txt .

RUN pip install --upgrade pip
RUN pip install -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1

CMD ["gunicorn", "marinex.wsgi:application", "--bind", "0.0.0.0:8001"]
