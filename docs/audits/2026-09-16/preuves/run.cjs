const {generateKeyPairSync} = require('node:crypto');
const {spawnSync} = require('node:child_process');
const keys=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
const env={...process.env,NODE_ENV:'test',DOTENV_CONFIG_PATH:'/dev/null',DATABASE_URL:'postgresql://audit:audit_local_only@127.0.0.1:55439/blessp_audit',JWT_PRIVATE_KEY_BASE64:Buffer.from(keys.privateKey).toString('base64'),JWT_PUBLIC_KEY_BASE64:Buffer.from(keys.publicKey).toString('base64'),STRIPE_SECRET_KEY:'sk_test_audit_placeholder',STRIPE_WEBHOOK_SECRET:'whsec_audit_placeholder',REDIS_URL:'',RESEND_API_KEY:'',POSTMARK_API_KEY:'',EMAIL_FROM:'',GOOGLE_CLIENT_ID:'audit-google-client',APPLE_CLIENT_ID:'audit-apple-client',LOG_LEVEL:'error',OTEL_ENABLED:'false',OTEL_TRACES_EXPORTER:'none',OTEL_METRICS_EXPORTER:'none',OTEL_LOGS_EXPORTER:'none',CLIENT_URL:'http://localhost:5179',CORS_ALLOWED_ORIGINS:'http://localhost:5179,http://localhost:3107',PORT:'3107',VITE_API_PROXY_TARGET:'http://localhost:3107',VITE_STRIPE_PUBLISHABLE_KEY:'',VITE_GOOGLE_CLIENT_ID:'',VITE_APPLE_CLIENT_ID:''};
const r=spawnSync(process.argv[2],process.argv.slice(3),{env,stdio:'inherit'});
if(r.error) console.error(r.error.message);
process.exit(r.status ?? 1);
