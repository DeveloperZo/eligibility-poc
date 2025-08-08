# Troubleshooting Guide - benefit plan Management System

This guide provides solutions to common issues encountered when testing and operating the benefit plan management system.

## Table of Contents

1. [System Startup Issues](#system-startup-issues)
2. [API Communication Problems](#api-communication-problems)
3. [Rule Creation Failures](#rule-creation-failures)
4. [Evaluation Issues](#evaluation-issues)
5. [Performance Problems](#performance-problems)
6. [Debugging Tools and Techniques](#debugging-tools-and-techniques)

## System Startup Issues

### Issue: Docker Services Won't Start

**Symptoms:**
- `docker-compose up -d` fails
- Error messages about port conflicts
- Services show as "unhealthy" in `docker-compose ps`

**Diagnosis:**
```bash
# Check if ports are already in use
netstat -tulpn | grep :3000
netstat -tulpn | grep :8080
netstat -tulpn | grep :5432

# Check Docker logs
docker-compose logs camunda
docker-compose logs postgres

# Verify Docker daemon is running
docker info
```

**Solutions:**
1. **Port Conflicts:**
   ```bash
   # Kill processes using required ports
   sudo lsof -ti:3000 | xargs kill -9
   sudo lsof -ti:8080 | xargs kill -9
   sudo lsof -ti:5432 | xargs kill -9
   
   # Or change ports in docker-compose.yml
   ```

2. **Docker Resource Issues:**
   ```bash
   # Clean up Docker system
   docker system prune -a
   docker volume prune
   
   # Restart Docker daemon
   sudo systemctl restart docker
   ```

## API Communication Problems

### Issue: Middleware API Returns 500 Errors

**Symptoms:**
- Internal server errors on API calls
- Uncaught exceptions in logs
- Database connection timeouts

**Diagnosis:**
```bash
# Check API health endpoint
curl -v http://localhost:3000/health

# Review middleware logs
tail -f middleware/logs/app.log

# Test database connectivity
docker-compose exec postgres psql -U camunda -c "SELECT version();"
```

**Solutions:**
1. **Database Issues:**
   ```bash
   # Restart database
   docker-compose restart postgres
   
   # Check database connections
   docker-compose exec postgres psql -U camunda -c "SELECT * FROM pg_stat_activity;"
   
   # Clear connection pool
   docker-compose restart middleware
   ```

### Issue: Cross-Origin (CORS) Errors

**Symptoms:**
- Browser console shows CORS errors
- Retool can't connect to middleware
- Preflight request failures

**Solutions:**
1. **Update CORS Configuration:**
   ```typescript
   // In middleware/src/app.ts
   app.use(cors({
     origin: [
       'https://your-retool-app.retool.com',
       'http://localhost:3000',
       'http://localhost:3001'
     ],
     credentials: true,
     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allowedHeaders: ['Content-Type', 'Authorization']
   }));
   ```

## Rule Creation Failures

### Issue: DMN XML Generation Fails

**Symptoms:**
- "Invalid DMN XML" errors
- Template parsing failures
- Malformed decision tables

**Solutions:**
1. **Template Issues:**
   ```bash
   # Verify template syntax
   cd middleware/src/templates
   node -e "console.log(require('./dmn-templates.ts'))"
   
   # Update templates if corrupted
   git checkout HEAD -- src/templates/dmn-templates.ts
   ```

## Evaluation Issues

### Issue: Incorrect Evaluation Results

**Symptoms:**
- Expected eligible employee marked as ineligible
- Inconsistent results across evaluations
- Missing evaluation reasoning

**Solutions:**
1. **Data Consistency:**
   ```bash
   # Verify employee data structure
   curl http://localhost:3001/employees | jq '.[0]'
   
   # Check for data type mismatches
   # Ensure age is number, not string
   ```

2. **Rule Logic Validation:**
   ```typescript
   // In evaluation.controller.ts, add debug logging
   console.log('Employee data:', employeeData);
   console.log('Rule configuration:', ruleConfig);
   console.log('DMN variables:', dmnVariables);
   ```

## Performance Problems

### Issue: Slow Response Times

**Symptoms:**
- API responses > 5 seconds
- Timeouts in Retool
- High CPU/memory usage

**Solutions:**
1. **Database Optimization:**
   ```sql
   -- Add indexes for common queries
   CREATE INDEX idx_rules_type ON rules(rule_type);
   CREATE INDEX idx_rules_status ON rules(status);
   
   -- Analyze query performance
   EXPLAIN ANALYZE SELECT * FROM rules WHERE rule_type = 'age';
   ```

2. **Caching Implementation:**
   ```typescript
   // Add Redis caching in middleware
   import Redis from 'ioredis';
   const redis = new Redis(process.env.REDIS_URL);
   
   // Cache employee data
   const cacheKey = `employee:${employeeId}`;
   let employee = await redis.get(cacheKey);
   if (!employee) {
     employee = await fetchEmployeeFromAPI(employeeId);
     await redis.setex(cacheKey, 300, JSON.stringify(employee));
   }
   ```

## Debugging Tools and Techniques

### Enable Debug Logging

```bash
# Set debug environment variables
export DEBUG=*
export LOG_LEVEL=debug
export NODE_ENV=development

# Start services with debug output
DEBUG=app:* npm run dev
```

### Health Check Scripts

```bash
#!/bin/bash
# health-check.sh
echo "Checking system health..."

# Check services
services=("middleware:3000" "data-api:3001" "camunda:8080")
for service in "${services[@]}"; do
  name=${service%%:*}
  port=${service##*:}
  if curl -f http://localhost:$port/health &>/dev/null; then
    echo "✅ $name is healthy"
  else
    echo "❌ $name is unhealthy"
  fi
done

# Check database
if docker-compose exec -T postgres pg_isready -U camunda; then
  echo "✅ Database is healthy"
else
  echo "❌ Database is unhealthy"
fi
```

### Performance Monitoring

```javascript
// Add performance monitoring middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${duration}ms`);
  });
  next();
});
```

## Emergency Recovery Procedures

### Complete System Reset

```bash
#!/bin/bash
# emergency-reset.sh
echo "Performing emergency system reset..."

# Stop all services
docker-compose down
npm run stop

# Clean up Docker system
docker system prune -af
docker volume prune -f

# Reset database
docker-compose up -d postgres
sleep 10
docker-compose exec postgres psql -U camunda -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restart all services
docker-compose up -d
npm run start

echo "System reset complete. Allow 2-3 minutes for full startup."
```

### Data Backup and Restore

```bash
# Backup
docker-compose exec postgres pg_dump -U camunda camunda > backup.sql
cp data/*.json backup/

# Restore
docker-compose exec -T postgres psql -U camunda camunda < backup.sql
cp backup/*.json data/
```

---

**Document Version:** 1.0  
**Last Updated:** July 19, 2025  
**Contact:** Development Team  
**Emergency Contact:** On-call Engineer
