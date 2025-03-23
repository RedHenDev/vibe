To change your GitHub Pages site to use a custom .com domain that you’ve purchased from IONOS, you’ll need to configure both your domain’s DNS settings at IONOS and your GitHub repository settings. Below is a step-by-step guide to help you through the process.
Step 1: Prepare Your GitHub Pages Site
Before linking your custom domain, ensure your GitHub Pages site is set up and working:
Check your site’s current URL: It should be something like https://username.github.io (for a user site) or https://username.github.io/repository (for a project site). Note this URL, as you’ll need it later. For example, if your site is at https://username.github.io, your GitHub Pages URL is username.github.io.
Verify the site is live: Visit the URL in your browser to confirm it’s published.
Step 2: Configure DNS Settings with IONOS
You’ll need to point your .com domain to GitHub’s servers by setting up DNS records. To make both example.com (apex domain) and www.example.com work, you’ll set up A records for the apex domain and a CNAME record for the www subdomain.
Log in to your IONOS account.
Navigate to domain management: Find your .com domain and go to its DNS settings.
Add A records for the apex domain (e.g., example.com):
Host/Name: Enter @ or leave it blank (this represents the apex domain).
Type: Select A.
Value: Add each of the following GitHub IP addresses one at a time:
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
TTL: Use the default value (often 3600 seconds, or 1 hour).
Repeat: Create four separate A records, one for each IP address.
Add a CNAME record for the www subdomain (e.g., www.example.com):
Host/Name: Enter www.
Type: Select CNAME.
Value: Enter your GitHub Pages URL (e.g., username.github.io.). Note: Include the trailing dot (.) at the end, as some registrars require it for CNAME records.
TTL: Use the default value (e.g., 3600 seconds).
Check for conflicts: If there are existing A or CNAME records for @ or www pointing elsewhere, update or remove them to avoid issues.
Step 3: Configure Your Custom Domain in GitHub
Next, tell GitHub to use your custom domain:
Go to your GitHub repository: Open the repository hosting your GitHub Pages site.
Access Settings: Click the Settings tab near the top-right.
Find the Pages section: Scroll down to Pages in the left sidebar.
Add your custom domain: Under "Custom domain," enter your domain (e.g., example.com) and click Save.
Enable HTTPS (optional): Once your domain is working, check the "Enforce HTTPS" box to secure your site. This may not be available until DNS changes propagate.
Step 4: Wait for DNS Propagation
After updating your DNS settings, it can take anywhere from a few minutes to 48 hours for the changes to take effect across the internet. During this time:
Your domain might not immediately point to your GitHub Pages site.
You can monitor progress using a tool like DNS Checker.
Additional Tips
Apex vs. www:
The A records ensure example.com works.
The CNAME record ensures www.example.com works.
Setting up both is recommended so users can access your site either way.
Email services: If you use your domain for email (e.g., through IONOS), ensure your MX records remain intact, as DNS changes can disrupt email if not handled carefully.
Troubleshooting:
If your site doesn’t load after a day, double-check your DNS records for typos (e.g., missing the dot in the CNAME value).
Confirm your GitHub Pages site is live and the custom domain is correctly entered in the repository settings.
If HTTPS fails, ensure DNS has propagated and "Enforce HTTPS" is enabled.
Summary
To point your IONOS .com domain to your GitHub Pages site:
IONOS DNS:
Add four A records for @ pointing to 185.199.108.153, 185.199.109.153, 185.199.110.153, and 185.199.111.153.
Add a CNAME record for www pointing to username.github.io..
GitHub:
Add your domain (e.g., example.com) in the Pages settings and save.
Optionally, enable HTTPS once it’s active.
Once the DNS propagates, your GitHub Pages site will be accessible at your custom .com domain! For more help, check GitHub’s documentation or IONOS support.