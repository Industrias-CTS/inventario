# AWS Deployment Instructions - Inventory Management System

## 🚀 Deployment Summary
The adaptive movements API solution has been pushed to GitHub and is ready for deployment to your AWS server.

## 📋 Pre-Deployment Checklist
- ✅ Code adapted for AWS database structure (using `type` column)
- ✅ Maintained backward compatibility with frontend
- ✅ Price update functionality preserved
- ✅ Frontend compiled for production
- ✅ Changes committed and pushed to GitHub

## 🔧 Deployment Steps

### 1. Connect to your AWS server
```bash
# Use your preferred method (SSH, AWS Console, etc.)
ssh -i your-key.pem ubuntu@your-aws-server-ip
```

### 2. Navigate to your application directory
```bash
cd /path/to/your/inventory-app
```

### 3. Pull the latest changes from GitHub
```bash
git pull origin main
```

### 4. Install/Update dependencies (if needed)
```bash
# Backend dependencies
cd backend
npm install

# Frontend dependencies (if updating frontend)
cd ../frontend
npm install
```

### 5. Build/Compile the application
```bash
# Backend compilation
cd backend
npm run build

# Frontend build (already done locally, but if needed on server)
cd ../frontend
npm run build
```

### 6. Update environment variables
Ensure your AWS server has the correct environment variables:

```bash
# Backend .env file should contain:
NODE_ENV=production
PORT=3000
DATABASE_PATH=/path/to/your/database.db
JWT_SECRET=your-jwt-secret

# Frontend environment (if using environment variables)
REACT_APP_API_URL=http://your-aws-server-ip:3000/api
```

### 7. Restart the services
```bash
# If using PM2
pm2 restart all

# If using systemctl
sudo systemctl restart your-app-service

# If using Docker
docker-compose down && docker-compose up -d

# If running directly
# Stop current process and start again
npm start
```

### 8. Verify deployment
```bash
# Check backend health
curl http://localhost:3000/api/health

# Check if movements endpoint is working
curl http://localhost:3000/api/movements

# Verify database structure
sqlite3 /path/to/your/database.db ".schema movements"
```

## 🔍 Key Changes in This Deployment

### Adaptive API Solution
- **Backward Compatible**: Accepts both `movement_type_id` (from frontend) and `type` (database column)
- **Type Mapping**: Automatically converts between frontend and database formats
- **Price Updates**: Preserves functionality to update `cost_price` when `unit_cost` is higher

### Database Compatibility
The solution works with your AWS database structure:
```sql
movements table:
- Uses `type` column with values: 'entrada', 'salida', 'reserva', 'liberacion', 'ajuste', 'transferencia'
- No `movement_types` table dependency
- No `movement_type_id` column required
```

### API Endpoints
All existing endpoints maintain their functionality:
- `POST /api/movements` - Create movement (accepts both parameter formats)
- `GET /api/movements` - List movements with filtering
- `POST /api/movements/invoice` - Create invoice movements
- `POST /api/movements/reservations` - Create reservations

## 🧪 Testing the Deployment

### 1. Test Movement Creation
```bash
# Test with movement_type_id (frontend format)
curl -X POST http://your-server:3000/api/movements \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "movement_type_id": "entrada001",
    "component_id": "component-id",
    "quantity": 10,
    "unit_cost": 25.50
  }'

# Test with type (direct format)
curl -X POST http://your-server:3000/api/movements \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "entrada",
    "component_id": "component-id", 
    "quantity": 5,
    "unit_cost": 30.00
  }'
```

### 2. Test Price Update Feature
- Create an entry (`entrada`) with a higher `unit_cost` than the current `cost_price`
- Verify that the component's `cost_price` is updated to the new higher value
- Create another entry with a lower `unit_cost` and verify the price doesn't decrease

### 3. Test Frontend Integration
- Access your frontend application
- Try adding movements through the UI
- Verify all movement types work correctly
- Check that price updates occur as expected

## 🔧 Troubleshooting

### If movements fail to create:
1. Check database permissions
2. Verify the `type` column accepts the expected values
3. Check server logs for specific error messages

### If price updates don't work:
1. Verify `unit_cost` is being passed correctly
2. Check that the component has a valid `cost_price` field
3. Confirm the operation type is 'IN' (entrada)

### If frontend compatibility issues occur:
1. Clear browser cache
2. Check network tab for API response errors  
3. Verify JWT token is valid

## 📊 Monitoring
After deployment, monitor:
- Server logs for any errors
- Database queries performance
- API response times
- Component price update behavior

## 🎉 Success Indicators
✅ Movements can be created successfully  
✅ Component prices update when entering higher unit costs  
✅ Frontend continues to work without changes  
✅ All existing functionality is preserved  
✅ No database structure changes required

---

**Note**: This solution maintains full compatibility with your AWS database while preserving all existing functionality and adding the requested price update feature.