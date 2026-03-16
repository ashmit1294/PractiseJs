# Security Best Practices

## Authentication: SCRAM vs LDAP

**WHAT**: How does MongoDB authenticate users?

**THEORY**:
- **SCRAM-SHA-256** (default): challenge-response authentication every connection
- **LDAP**: external directory service (Active Directory, OpenLDAP)
- **X.509 certificate**: for machine-to-machine authentication
- **Always require authentication** in production (never bare access)

```javascript
// Create user with authentication
use admin;

db.createUser({
  user: "appUser",
  pwd: passwordPrompt(),  // prompt for password
  roles: [ "readWrite" ]
});

// Connection string with authentication
mongodb://appUser:password@mongodb.example.com:27017/mydb?authSource=admin

// In Node.js driver
const client = new MongoClient(
  "mongodb://appUser:password@localhost:27017/mydb",
  { authSource: "admin" }
);

// Better: use environment variables
const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:27017/mydb`;
```

---

## Authorization: Role-Based Access Control (RBAC)

**WHAT**: How do I enforce what each user can do?

**THEORY**:
- MongoDB uses **roles** for granular permissions
- Built-in roles: `read`, `readWrite`, `dbOwner`, `backup`, `restore`, `root`
- Custom roles for application-specific permissions
- Database level and collection level access control

```javascript
// Grant read-only access to specific database
use admin;
db.createUser({
  user: "analyticsUser",
  pwd: "password123",
  roles: [
    { role: "read", db: "analytics" }  // read-only on analytics DB
  ]
});

// Grant admin permissions
db.createUser({
  user: "adminUser",
  pwd: "password123",
  roles: [
    { role: "root", db: "admin" }  // full access to all DBs
  ]
});

// Custom role with limited permissions
db.createRole({
  role: "orderProcessor",
  privileges: [
    { resource: { db: "shop", collection: "orders" }, actions: ["find", "insert", "update"] },
    { resource: { db: "shop", collection: "inventory" }, actions: ["find", "update"] }
  ],
  roles: []
});

db.createUser({
  user: "processor",
  pwd: "password123",
  roles: [
    { role: "orderProcessor", db: "shop" }
  ]
});
```

**Built-in Roles**:
| Role | Permissions | Use Case |
|------|-------------|----------|
| read | Find, listCollections | Read-only dashboards |
| readWrite | read + insert, update, delete | Applications |
| dbOwner | admin + readWrite | Application owner |
| bulk | bulkWrite, createIndex | Bulk operations |
| backup | finds all data, ignores user restrictions | Backup agents |
| root | admin on all DBs | Emergency access |

---

## Encryption: At Rest & In Transit

### Encryption in Transit (TLS)

```javascript
// Client connection with TLS
const client = new MongoClient(uri, {
  tls: true,
  tlsCertificateKeyFile: "/path/to/client-cert.pem",
  tlsCAFile: "/path/to/ca-cert.pem"
});

// MongoDB server configuration
mongod --tls \
  --tlsCertificateKeyFile /path/to/server-cert.pem \
  --tlsCAFile /path/to/ca-cert.pem
```

### Encryption at Rest (Database-Level)

```javascript
// Configure MongoDB with encrypted storage engine
mongod --encryptionCipherMode AES256-CBC \
  --encryptionKeyFile /path/to/keyfile \
  --enableEncryption
```

**Where sensitive data stored**:
- User passwords (hashed with SCRAM)
- Connection strings (keep in environment variables)
- API keys (never commit to code)

---

## Least Privilege Principle

**WHAT**: How do I minimize exposure if credentials are compromised?

**THEORY**:
- Each application component gets **minimum required permissions**
- Web API user: `readWrite` on `users`, `orders` only
- Reporting system: `read` on `analytics` DB only
- Backup service: `backup` role only
- Reduces blast radius if service compromised

```javascript
use admin;

// Web API service: only access app database
db.createUser({
  user: "api_service",
  pwd: "api_password",
  roles: [
    { role: "readWrite", db: "production" }
  ]
});

// Analytics service: read-only access
db.createUser({
  user: "analytics_service",
  pwd: "analytics_password",
  roles: [
    { role: "read", db: "production" }
  ]
});

// Backup service: backup role only (limited permissions)
db.createUser({
  user: "backup_service",
  pwd: "backup_password",
  roles: [
    { role: "backup", db: "admin" }
  ]
});

// Scheduler: update specific collection only
db.createRole({
  role: "taskUpdater",
  privileges: [
    {
      resource: { db: "production", collection: "scheduled_tasks" },
      actions: ["find", "update"]
    }
  ],
  roles: []
});

db.createUser({
  user: "scheduler",
  pwd: "scheduler_password",
  roles: [
    { role: "taskUpdater", db: "production" }
  ]
});
```

---

## Injection Prevention

**WHAT**: How do MongoDB injection attacks happen?

**THEORY**:
- **MongoDB injection**: passing raw user input to queries
- Attacker can modify query logic (like SQL injection)
- Prevention: **parameterized queries** (always use `{}` placeholders)

```javascript
// ❌ VULNERABLE: user input builds query object
const email = req.query.email;  // user input: "john@example.com" OR {"$ne": null}"
const user = db.users.findOne({ email: email });
// User input could be: { $ne: null } → finds ANY user!

// ✅ SAFE: use fields directly (MongoDB driver handles escaping)
const email = req.query.email;
const user = db.users.findOne({ email: email });  // exact match, safe

// ❌ VULNERABLE: building query strings (if using raw strings)
const query = `{ email: "${email}" }`;
const user = db.users.findOne(eval(query));  // Never use eval!

// ✅ SAFE: always use parameterized queries
db.users.findOne({ email: email });
db.users.findOne({ age: { $gt: parseInt(ageParam) } });

// Additional safety: schema validation
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      properties: {
        email: { bsonType: "string", pattern: "^.+@.+\\..+$" }
      }
    }
  }
});
```

---

## Network Security

```javascript
// MongoDB binding: only listen on specific IPs (not 0.0.0.0)
mongod --bind_ip localhost,10.0.0.5

// Firewall rules: only allow app servers to connect
iptables -A INPUT -p tcp --dport 27017 -s 10.0.0.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 27017 -j DROP

// VPC/Private Network: MongoDB only accessible within VPC
# AWS Security Group: inbound rule
Source: sg-app-servers (application security group)
Port: 27017
```

---

## Audit Logging

```javascript
// Enable audit logging to track all operations
mongod --auditLog \
  --auditDestination file \
  --auditFormat JSON \
  --auditLogRotation daily

// Access audit log
tail -f /var/log/mongodb/audit.json

// Sample audit entry
{
  "atype": "createIndex",
  "auth": { "principalName": "admin", "principalType": "user" },
  "db": "production",
  "ns": "production.users",
  "command": { "index": { "email": 1 } },
  "result": 0,
  "timestamp": ISODate("2024-01-15T10:30:00Z"),
  "ts": Timestamp(1705317000, 1)
}

// Query audit log for suspicious activity
// Unauthenticated connections attempts
// Failed authorization
// Schema modifications
```

---

## Security Checklist for Production

- ✅ Authentication enabled (SCRAM-SHA-256 or LDAP)
- ✅ Authorization: least privilege roles assigned
- ✅ TLS enabled for client connections
- ✅ Encryption at rest configured
- ✅ Network restricted to application servers only
- ✅ No default admin user (change default password)
- ✅ Connection strings in environment variables (not hardcoded)
- ✅ Audit logging enabled
- ✅ Regular password rotation policy
- ✅ Backup protected (encryption, separate storage)
- ✅ Parameterized queries only (prevent injection)
- ✅ Schema validation enabled (enforce structure)
- ✅ Multi-factor authentication for admin accounts
- ✅ Regular security updates (patch MongoDB)
