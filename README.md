# REHABS Railway Deployment

## Files needed for Railway:

Copy these files from `c:\Users\ruinh\Documents\rehabs\bot\` to this folder:

1. **index.js** ✅ (already copied)
2. **package.json** ✅ (already copied)
3. **api.js** - Copy from bot folder
4. **bot.js** - Copy from bot folder
5. **database.js** - Copy from bot folder

## How to deploy:

1. Copy the 3 missing files (api.js, bot.js, database.js) to this folder
2. Upload ALL 5 files to Railway
3. Set environment variables in Railway:
   - `DISCORD_TOKEN` = Your Discord bot token
   - `ADMIN_IDS` = Your Discord user IDs (comma separated)
   - `PORT` = 3000

## Files NOT needed:
- node_modules/ (Railway installs automatically)
- .env (use Railway environment variables instead)
- keys.json (created automatically)
- users.json (created automatically)
- All .bat, .txt files (local setup only)

## After deployment:
Your API will be available at:
- https://newrehab-production.up.railway.app/api/get-config?username=USERNAME
