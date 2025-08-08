# Kubernetes Migration Guide

This guide demonstrates how the Docker Compose setup translates to Kubernetes, providing a foundation for production deployment.

## Architecture Translation

### Docker Compose → Kubernetes Mapping

| Docker Compose | Kubernetes | Purpose |
|---------------|------------|---------|
| Service | Deployment + Service | Application workload |
| Volume | PersistentVolumeClaim | Data persistence |
| Network | NetworkPolicy | Network isolation |
| Environment | ConfigMap + Secret | Configuration |
| Ports | Service + Ingress | External access |

## Kubernetes Manifests Structure

```
kubernetes/
├── namespaces/
│   └── eligibility-namespace.yaml
├── configmaps/
│   ├── retool-config.yaml
│   ├── middleware-config.yaml
│   └── camunda-config.yaml
├── secrets/
│   ├── retool-secrets.yaml
│   ├── database-secrets.yaml
│   └── api-secrets.yaml
├── persistentvolumes/
│   ├── retool-pvc.yaml
│   ├── camunda-pvc.yaml
│   └── postgres-pvc.yaml
├── deployments/
│   ├── retool/
│   │   ├── retool-deployment.yaml
│   │   ├── retool-db-deployment.yaml
│   │   └── retool-jobs-deployment.yaml
│   ├── camunda/
│   │   ├── camunda-deployment.yaml
│   │   └── camunda-db-deployment.yaml
│   ├── middleware-deployment.yaml
│   └── data-api-deployment.yaml
├── services/
│   ├── retool-service.yaml
│   ├── camunda-service.yaml
│   ├── middleware-service.yaml
│   └── data-api-service.yaml
├── ingress/
│   ├── retool-ingress.yaml
│   └── api-ingress.yaml
├── networkpolicies/
│   └── eligibility-network-policy.yaml
└── kustomization.yaml
```

## Sample Kubernetes Manifests

### 1. Namespace

```yaml
# kubernetes/namespaces/eligibility-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: eligibility-system
  labels:
    app: eligibility
    environment: production
```

### 2. ConfigMap Example (Middleware)

```yaml
# kubernetes/configmaps/middleware-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: middleware-config
  namespace: eligibility-system
data:
  NODE_ENV: "production"
  CAMUNDA_BASE_URL: "http://camunda-service:8080"
  DATA_API_URL: "http://data-api-service:3001"
  DB_HOST: "camunda-postgres-service"
  DB_PORT: "5432"
  DB_NAME: "camunda"
  CORS_ORIGIN: "http://retool-service:3000"
```

### 3. Secret Example

```yaml
# kubernetes/secrets/retool-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: retool-secrets
  namespace: eligibility-system
type: Opaque
data:
  JWT_SECRET: <base64-encoded-value>
  ENCRYPTION_KEY: <base64-encoded-value>
  POSTGRES_PASSWORD: <base64-encoded-value>
```

### 4. PersistentVolumeClaim

```yaml
# kubernetes/persistentvolumes/retool-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: retool-data-pvc
  namespace: eligibility-system
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: standard
```

### 5. Deployment Example (Retool)

```yaml
# kubernetes/deployments/retool/retool-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: retool
  namespace: eligibility-system
  labels:
    app: retool
    component: backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: retool
      component: backend
  template:
    metadata:
      labels:
        app: retool
        component: backend
    spec:
      containers:
      - name: retool
        image: tryretool/backend:latest
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: POSTGRES_HOST
          value: "retool-postgres-service"
        - name: POSTGRES_PORT
          value: "5432"
        - name: POSTGRES_DB
          value: "hammerhead_production"
        - name: POSTGRES_USER
          value: "retool"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: retool-secrets
              key: POSTGRES_PASSWORD
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: retool-secrets
              key: JWT_SECRET
        - name: ENCRYPTION_KEY
          valueFrom:
            secretKeyRef:
              name: retool-secrets
              key: ENCRYPTION_KEY
        volumeMounts:
        - name: retool-storage
          mountPath: /var/lib/retool
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/checkHealth
            port: 3000
          initialDelaySeconds: 60
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/checkHealth
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
      volumes:
      - name: retool-storage
        persistentVolumeClaim:
          claimName: retool-data-pvc
```

### 6. Service Example

```yaml
# kubernetes/services/retool-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: retool-service
  namespace: eligibility-system
  labels:
    app: retool
spec:
  type: ClusterIP
  ports:
  - port: 3000
    targetPort: 3000
    protocol: TCP
    name: http
  selector:
    app: retool
    component: backend
```

### 7. Ingress Example

```yaml
# kubernetes/ingress/retool-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: retool-ingress
  namespace: eligibility-system
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  tls:
  - hosts:
    - retool.yourdomain.com
    secretName: retool-tls
  rules:
  - host: retool.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: retool-service
            port:
              number: 3000
```

### 8. NetworkPolicy Example

```yaml
# kubernetes/networkpolicies/eligibility-network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: eligibility-network-policy
  namespace: eligibility-system
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: eligibility-system
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: eligibility-system
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
```

## Deployment Process

### 1. Prerequisites

```bash
# Install kubectl
# Install Helm (optional, for package management)
# Configure kubectl context
kubectl config current-context
```

### 2. Create Namespace

```bash
kubectl create namespace eligibility-system
kubectl config set-context --current --namespace=eligibility-system
```

### 3. Deploy Secrets and ConfigMaps

```bash
# Generate secrets
kubectl create secret generic retool-secrets \
  --from-literal=JWT_SECRET=$(openssl rand -hex 32) \
  --from-literal=ENCRYPTION_KEY=$(openssl rand -hex 32) \
  --from-literal=POSTGRES_PASSWORD=$(openssl rand -hex 16) \
  -n eligibility-system

# Apply ConfigMaps
kubectl apply -f kubernetes/configmaps/
```

### 4. Deploy Storage

```bash
kubectl apply -f kubernetes/persistentvolumes/
```

### 5. Deploy Databases

```bash
kubectl apply -f kubernetes/deployments/retool/retool-db-deployment.yaml
kubectl apply -f kubernetes/deployments/camunda/camunda-db-deployment.yaml
kubectl apply -f kubernetes/services/retool-db-service.yaml
kubectl apply -f kubernetes/services/camunda-db-service.yaml

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=retool-postgres -n eligibility-system --timeout=300s
kubectl wait --for=condition=ready pod -l app=camunda-postgres -n eligibility-system --timeout=300s
```

### 6. Deploy Applications

```bash
kubectl apply -f kubernetes/deployments/
kubectl apply -f kubernetes/services/
```

### 7. Configure Ingress

```bash
# Install NGINX Ingress Controller (if not already installed)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml

# Apply Ingress rules
kubectl apply -f kubernetes/ingress/
```

### 8. Verify Deployment

```bash
# Check all pods
kubectl get pods -n eligibility-system

# Check services
kubectl get svc -n eligibility-system

# Check ingress
kubectl get ingress -n eligibility-system

# View logs
kubectl logs -l app=retool -n eligibility-system
```

## Helm Chart Structure (Advanced)

For production, consider creating a Helm chart:

```
eligibility-chart/
├── Chart.yaml
├── values.yaml
├── values-dev.yaml
├── values-prod.yaml
├── templates/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   └── _helpers.tpl
└── charts/
    ├── retool/
    ├── camunda/
    └── postgresql/
```

### Sample values.yaml

```yaml
# eligibility-chart/values.yaml
global:
  namespace: eligibility-system
  environment: production
  
retool:
  enabled: true
  replicas: 2
  image:
    repository: tryretool/backend
    tag: latest
    pullPolicy: IfNotPresent
  resources:
    requests:
      memory: "1Gi"
      cpu: "500m"
    limits:
      memory: "2Gi"
      cpu: "1000m"
  ingress:
    enabled: true
    hostname: retool.yourdomain.com
    tls: true
    
camunda:
  enabled: true
  replicas: 2
  persistence:
    enabled: true
    size: 10Gi
    
middleware:
  enabled: true
  replicas: 3
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPU: 70
    
dataApi:
  enabled: true
  replicas: 2
  
postgresql:
  enabled: true
  persistence:
    enabled: true
    size: 20Gi
  metrics:
    enabled: true
```

## Production Considerations

### 1. High Availability

```yaml
# Enable pod disruption budgets
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: retool-pdb
  namespace: eligibility-system
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: retool
```

### 2. Autoscaling

```yaml
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: middleware-hpa
  namespace: eligibility-system
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: middleware
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 3. Monitoring with Prometheus

```yaml
# ServiceMonitor for Prometheus
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: eligibility-metrics
  namespace: eligibility-system
spec:
  selector:
    matchLabels:
      app: eligibility
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

### 4. Backup Strategy

```yaml
# CronJob for database backups
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: eligibility-system
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: postgres-backup
            image: postgres:13
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: database-secrets
                  key: postgres-password
            command:
            - /bin/bash
            - -c
            - |
              DATE=$(date +%Y%m%d_%H%M%S)
              pg_dump -h retool-postgres-service -U retool hammerhead_production > /backup/retool-$DATE.sql
              pg_dump -h camunda-postgres-service -U camunda camunda > /backup/camunda-$DATE.sql
              # Upload to S3 or other storage
            volumeMounts:
            - name: backup
              mountPath: /backup
          volumes:
          - name: backup
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
```

## Migration Script

```bash
#!/bin/bash
# migrate-to-k8s.sh

echo "🚀 Migrating Docker Compose to Kubernetes"
echo "========================================="

# Check prerequisites
command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required but not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "docker is required but not installed."; exit 1; }

# Export data from Docker volumes
echo "📦 Exporting data from Docker volumes..."
docker run --rm -v eligibility-poc_retool-postgres-data:/data -v $(pwd)/backup:/backup alpine tar czf /backup/retool-db.tar.gz /data
docker run --rm -v eligibility-poc_camunda-postgres-data:/data -v $(pwd)/backup:/backup alpine tar czf /backup/camunda-db.tar.gz /data

# Create namespace
echo "🏗️ Creating Kubernetes namespace..."
kubectl create namespace eligibility-system

# Generate secrets
echo "🔐 Creating secrets..."
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -hex 16)

kubectl create secret generic retool-secrets \
  --from-literal=JWT_SECRET=$JWT_SECRET \
  --from-literal=ENCRYPTION_KEY=$ENCRYPTION_KEY \
  --from-literal=POSTGRES_PASSWORD=$DB_PASSWORD \
  -n eligibility-system

# Apply manifests
echo "📄 Applying Kubernetes manifests..."
kubectl apply -f kubernetes/

# Wait for pods
echo "⏳ Waiting for pods to be ready..."
kubectl wait --for=condition=ready pod --all -n eligibility-system --timeout=600s

# Import data
echo "📥 Importing data to Kubernetes volumes..."
# This would require setting up jobs to restore the data

echo "✅ Migration complete!"
echo ""
echo "Access points:"
echo "  kubectl port-forward svc/retool-service 3333:3000 -n eligibility-system"
echo "  kubectl port-forward svc/camunda-service 8080:8080 -n eligibility-system"
```

## Troubleshooting in Kubernetes

### Common Issues and Solutions

1. **Pod not starting**
```bash
kubectl describe pod <pod-name> -n eligibility-system
kubectl logs <pod-name> -n eligibility-system
```

2. **Database connection issues**
```bash
# Test connectivity
kubectl run -it --rm debug --image=busybox --restart=Never -n eligibility-system -- sh
# Inside the pod:
nslookup retool-postgres-service
telnet retool-postgres-service 5432
```

3. **Storage issues**
```bash
kubectl get pvc -n eligibility-system
kubectl describe pvc <pvc-name> -n eligibility-system
```

4. **Ingress not working**
```bash
kubectl get ingress -n eligibility-system
kubectl describe ingress retool-ingress -n eligibility-system
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
```

## Cost Optimization

### Resource Recommendations

| Component | Dev/Test | Production |
|-----------|----------|------------|
| Retool | 0.5 CPU, 512Mi RAM | 2 CPU, 2Gi RAM |
| Middleware | 0.25 CPU, 256Mi RAM | 1 CPU, 1Gi RAM |
| Camunda | 0.5 CPU, 512Mi RAM | 2 CPU, 2Gi RAM |
| PostgreSQL | 0.5 CPU, 512Mi RAM | 2 CPU, 4Gi RAM |

### Using Spot Instances

```yaml
# Node selector for spot instances
spec:
  nodeSelector:
    node.kubernetes.io/lifecycle: spot
  tolerations:
  - key: "spot"
    operator: "Equal"
    value: "true"
    effect: "NoSchedule"
```

## Security Best Practices

1. **Use RBAC**
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: eligibility-operator
  namespace: eligibility-system
rules:
- apiGroups: ["apps", ""]
  resources: ["deployments", "pods", "services"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
```

2. **Enable Pod Security Policies**
```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: eligibility-psp
spec:
  privileged: false
  runAsUser:
    rule: MustRunAsNonRoot
  seLinux:
    rule: RunAsAny
  fsGroup:
    rule: RunAsAny
```

3. **Use Network Policies**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-ingress
  namespace: eligibility-system
spec:
  podSelector: {}
  policyTypes:
  - Ingress
```

## Conclusion

This migration guide provides a comprehensive path from Docker Compose to Kubernetes. The key benefits of moving to Kubernetes include:

- **Scalability**: Easy horizontal scaling of services
- **High Availability**: Built-in redundancy and failover
- **Resource Efficiency**: Better resource utilization
- **Declarative Configuration**: GitOps-ready infrastructure
- **Advanced Features**: Service mesh, autoscaling, rolling updates

Start with the Docker Compose setup for development and testing, then use this guide to migrate to Kubernetes for production deployment.
