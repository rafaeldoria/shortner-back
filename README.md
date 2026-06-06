# Shortener Back

## 1. Arquitetura do projeto

API construída com Node.js, TypeScript e Express, utilizando MongoDB com Mongoose
para persistência e JWT para autenticação.

```text
src/
  config/       Configuração das variáveis de ambiente
  database/     Conexão com o MongoDB
  middleware/   Autenticação das requisições
  modules/
    auth/       Cadastro e login de usuários
    url/        Criação e listagem de URLs encurtadas
  app.ts        Configuração da aplicação Express
  server.ts     Inicialização do servidor
```

Fluxo principal:

```text
Requisição -> Rota -> Controller -> Service -> Model -> MongoDB
```

## 2. Como executar

Pré-requisitos: Node.js 20+, npm e uma instância MongoDB disponível.

```bash
npm ci
cp .env.example .env
```

Preencha o arquivo `.env` com a conexão do MongoDB, URL base, URL do frontend,
segredo JWT, credenciais do Resend para envio de verificação de e-mail e
`ALERT_SEND_EMAIL` para receber alertas de quantidade total de URLs cadastradas.
Caso `PORT` não seja informada, a API utilizará a porta `3100`.

Para executar em desenvolvimento:

```bash
npm run dev
```

Para gerar e executar a versão compilada:

```bash
npm run build
npm start
```

Com Docker:

```bash
docker compose up --build
```

## 3. Testes

Os testes unitários utilizam Jest com TypeScript. As dependências externas
como MongoDB, JWT, bcrypt, Resend e geradores de código são mockadas nos testes,
sem chamadas reais para banco de dados ou serviços externos.

Para executar a suíte:

```bash
npm test
```

Para executar os testes com relatório de cobertura:

```bash
npm run test:coverage
```

## 4. Projeto

Backend de um encurtador de URLs: autentica usuários e permite criar e consultar
links encurtados armazenados no MongoDB.
