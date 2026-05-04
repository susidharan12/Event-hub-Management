const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { consumeVerifiedToken } = require('../routes/otp');

// Use environment variable (loaded by server.js) or fallback
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key';

// 1. Signup Logic
exports.signup = async (req, res) => {
  const {
    name, mobile, email, password, role, address,
    organization_name, organization_address, organization_phone,
    organization_website, organization_description,
    // Optional: a verification_token issued by /api/otp/verify with
    // purpose='signup'. When supplied we consume it and trust the email
    // is verified. When absent we still accept the signup (back-compat).
    verification_token
  } = req.body;

  console.log('\n=== SIGNUP REQUEST ===');
  console.log('User data received:', {
    name, mobile, email, role,
    has_org_details: !!(organization_name || organization_address),
    password_length: password?.length
  });

  try {
    // Organizer signups must include the organization name + address.
    if (role === 'organizer') {
      if (!organization_name || !String(organization_name).trim()) {
        return res.status(400).json({ message: 'Organization name is required for organizer accounts' });
      }
      if (!organization_address || !String(organization_address).trim()) {
        return res.status(400).json({ message: 'Organization address is required for organizer accounts' });
      }
    }

    // Check if user exists
    console.log('Checking if user already exists...');
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR mobile = $2',
      [email, mobile]
    );

    if (existingUser.rows.length > 0) {
      console.error('Signup failed: user already exists with email or mobile', { email, mobile });
      return res.status(409).json({ message: "User already exists with this email or mobile number" });
    }

    console.log('User does not exist, proceeding with registration...');

    // OTP gate (optional, opt-in via verification_token).
    if (verification_token) {
      const ok = await consumeVerifiedToken(pool, {
        token:   verification_token,
        target:  email,
        purpose: 'signup'
      });
      if (!ok) {
        return res.status(400).json({ message: 'Email OTP token is invalid or expired. Please verify your email again.' });
      }
      console.log('Email OTP verified for signup');
    }

    console.log('Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Password hashed successfully');

    console.log('Inserting user into database...');
    const newUser = await pool.query(
      `INSERT INTO users (
         name, mobile, email, password_hash, role, address,
         organization_name, organization_address, organization_phone,
         organization_website, organization_description
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, name, email, mobile, role, profile_image, address,
                 organization_name, organization_address, organization_phone,
                 organization_website, organization_description`,
      [
        name, mobile, email, hashedPassword, role || 'explorer',
        address || null,
        role === 'organizer' ? (organization_name || null) : null,
        role === 'organizer' ? (organization_address || null) : null,
        role === 'organizer' ? (organization_phone || null) : null,
        role === 'organizer' ? (organization_website || null) : null,
        role === 'organizer' ? (organization_description || null) : null
      ]
    );

    if (!newUser.rows[0]) {
      console.error('Signup failed: no user returned from INSERT');
      return res.status(500).json({ message: 'Signup failed. Please try again.' });
    }

    const userData = newUser.rows[0];
    console.log('User inserted successfully:', userData);

    console.log('Generating JWT token...');
    const token = jwt.sign({ id: userData.id, role: userData.role }, JWT_SECRET, { expiresIn: '24h' });
    console.log('Token generated successfully (24 hour expiry)');

    console.log('\n=== SIGNUP SUCCESSFUL ===');
    console.log('User:', userData);
    console.log('Timestamp:', new Date().toISOString());
    console.log('================\n');

    res.status(201).json({ 
      message: "User registered successfully",
      token,
      user: userData
    });

  } catch (err) {
    console.error('SIGNUP ERROR:', err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({ message: "Signup failed" });
  }
};


// 2. Login Logic
exports.login = async (req, res) => {
  const { email, password } = req.body;
  
  console.log('\n=== LOGIN REQUEST ===');
  console.log('Email:', email);
  console.log('Password length:', password?.length);

  try {
    console.log('Querying database for user by email...');
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    console.log('Database query result:', result.rows.length, 'user(s) found');
    
    if (result.rows.length === 0) {
      console.error('Login failed: user not found for email', { email });
      return res.status(400).json({ message: "User not found" });
    }

    const user = result.rows[0];
    console.log('User found in database:', {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role
    });

    console.log('Comparing password hashes...');
    const isMatch = await bcrypt.compare(password, user.password_hash);
    console.log('Password verification:', isMatch ? 'MATCH ' : 'NO MATCH ');
    
    if (!isMatch) {
      console.error('Login failed: incorrect password for user', { id: user.id, email: user.email });
      return res.status(400).json({ message: "Invalid credentials" });
    }

    console.log('Generating JWT token...');
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    console.log('Token generated successfully');
    console.log('Token expiry: 24 hours');

    console.log('\n=== LOGIN SUCCESSFUL ===');
    console.log('User:', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mobile: user.mobile
    });
    console.log('Timestamp:', new Date().toISOString());
    console.log('================\n');

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email,
        mobile: user.mobile,
        role: user.role 
      } 
    });
  } catch (err) {
    console.error('LOGIN ERROR:', err.message);
    res.status(500).json({ message: "Login error" });
  }
};

// 3. Get Profile Logic
exports.getProfile = async (req, res) => {
  try {
    const user = await pool.query(
      `SELECT id, name, mobile, email, role, profile_image, address,
              organization_name, organization_address, organization_phone,
              organization_website, organization_description, created_at
         FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (user.rows.length === 0) return res.status(404).json({ message: "User not found" });

    const d = user.rows[0];
    res.json({
      id: d.id,
      // Both keys are returned so existing UI ("username") and new code ("name") work.
      username: d.name,
      name: d.name,
      mobile: d.mobile,
      email: d.email,
      role: d.role,
      profile_image: d.profile_image,
      address: d.address,
      organization_name: d.organization_name,
      organization_address: d.organization_address,
      organization_phone: d.organization_phone,
      organization_website: d.organization_website,
      organization_description: d.organization_description,
      created_at: d.created_at
    });
  } catch (err) {
    console.error("Profile Fetch Error:", err.message);
    res.status(500).json({ message: "Error fetching profile" });
  }
};

// 4. Update Profile Logic
exports.updateProfile = async (req, res) => {
  const {
    name, mobile, email, address,
    organization_name, organization_address, organization_phone,
    organization_website, organization_description,
    // Optional OTP tokens — required when the corresponding contact field
    // is being changed. Caller obtains them via /api/otp/verify.
    email_verification_token,
    mobile_verification_token
  } = req.body;

  // Build a sparse UPDATE so callers only need to send the fields they want to change.
  const sets = [];
  const values = [];
  const push = (column, value) => {
    if (value === undefined) return;
    values.push(value === '' ? null : value);
    sets.push(`${column} = $${values.length}`);
  };
  push('name', name);
  push('mobile', mobile);
  push('email', email);
  push('address', address);
  push('organization_name', organization_name);
  push('organization_address', organization_address);
  push('organization_phone', organization_phone);
  push('organization_website', organization_website);
  push('organization_description', organization_description);

  if (sets.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  try {
    // OTP gate: when email/mobile is changing, the user must have verified
    // a fresh OTP for the NEW value. Compare against the current row to
    // detect changes — if the value is unchanged we don't require a token.
    if (email !== undefined || mobile !== undefined) {
      const cur = await pool.query('SELECT email, mobile FROM users WHERE id = $1', [req.user.id]);
      const currentEmail  = cur.rows[0] ? cur.rows[0].email  : null;
      const currentMobile = cur.rows[0] ? cur.rows[0].mobile : null;

      if (email !== undefined && email && email !== currentEmail) {
        const ok = await consumeVerifiedToken(pool, {
          token:   email_verification_token,
          target:  email,
          purpose: 'update-email'
        });
        if (!ok) {
          return res.status(400).json({ message: 'Please verify your new email with an OTP before saving.' });
        }
      }
      if (mobile !== undefined && mobile && mobile !== currentMobile) {
        const ok = await consumeVerifiedToken(pool, {
          token:   mobile_verification_token,
          target:  mobile,
          purpose: 'update-mobile'
        });
        if (!ok) {
          return res.status(400).json({ message: 'Please verify your new mobile with an OTP before saving.' });
        }
      }
    }

    values.push(req.user.id);
    const sql = `UPDATE users SET ${sets.join(', ')}
                 WHERE id = $${values.length}
                 RETURNING id, name, mobile, email, role, profile_image, address,
                           organization_name, organization_address, organization_phone,
                           organization_website, organization_description`;
    const result = await pool.query(sql, values);
    res.json({ message: "Profile updated successfully", user: result.rows[0] });
  } catch (err) {
    console.error("Update Error:", err.message);
    res.status(500).json({ message: "Update failed" });
  }
};

// 5. Upload profile image (avatar)
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }
    const url = `/uploads/${req.file.filename}`;
    const result = await pool.query(
      `UPDATE users SET profile_image = $1
         WHERE id = $2
         RETURNING id, name, email, mobile, role, profile_image`,
      [url, req.user.id]
    );
    res.json({ message: 'Profile image updated', profile_image: url, user: result.rows[0] });
  } catch (err) {
    console.error('Avatar Upload Error:', err.message);
    res.status(500).json({ message: 'Avatar upload failed' });
  }
};

// 5. Send OTP (Placeholder)
exports.sendOTP = async (req, res) => {
  res.json({ message: "OTP sent successfully (Mock)" });
};

// ─────────────────────────────────────────────────────────────────
// Forgot Password — start
// Body: { mobile }
// Returns success + masked email so the UI can tell the user where to look.
// The actual OTP is sent by /api/otp/send under purpose='password-reset',
// so the frontend just calls /api/otp/send first; this endpoint exists as a
// convenience to verify the mobile is registered before prompting for OTP.
// ─────────────────────────────────────────────────────────────────
exports.forgotPasswordRequest = async (req, res) => {
  try {
    const { mobile, email } = req.body || {};
    if (!mobile && !email) {
      return res.status(400).json({ error: 'Mobile number or email is required' });
    }

    // Accept either channel. We trim and look the user up by whichever
    // identifier was supplied.
    const target = (email ? String(email).trim() : String(mobile).trim());
    const target_type = email ? 'email' : 'mobile';
    const sql = email
      ? 'SELECT id, name, email, mobile FROM users WHERE email = $1'
      : 'SELECT id, name, email, mobile FROM users WHERE mobile = $1';

    const r = await pool.query(sql, [target]);
    if (r.rows.length === 0) {
      return res.status(404).json({
        error: email ? 'No account found for this email.' : 'No account found for this mobile number.'
      });
    }
    const u = r.rows[0];
    // Mask the email for display.
    const [user, dom] = (u.email || '').split('@');
    const masked = !user ? '' :
      (user.length <= 2 ? user[0] + '*' : user[0] + '***' + user[user.length - 1]) + '@' + dom;
    res.json({
      success: true,
      name: u.name,
      delivered_to: masked,           // we always deliver via email
      target_type                     // echo so the client knows which channel won
    });
  } catch (err) {
    console.error('forgotPasswordRequest error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
};

// ─────────────────────────────────────────────────────────────────
// Forgot Password — reset
// Body: { mobile, verification_token, new_password }
// The caller must have already verified an OTP via /api/otp/verify
// (purpose='password-reset') and pass the resulting token here.
// ─────────────────────────────────────────────────────────────────
exports.forgotPasswordReset = async (req, res) => {
  const client = await pool.connect();
  try {
    const { mobile, email, verification_token, new_password } = req.body || {};
    if ((!mobile && !email) || !verification_token || !new_password) {
      return res.status(400).json({ error: 'identifier (mobile or email), verification_token and new_password are required' });
    }
    if (String(new_password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    await client.query('BEGIN');

    // Whichever channel was used to send the OTP must match the token.
    const target = email ? String(email).trim() : String(mobile).trim();

    const ok = await consumeVerifiedToken(client, {
      token:   verification_token,
      target,
      purpose: 'password-reset'
    });
    if (!ok) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'OTP token is invalid or expired. Please verify the OTP again.' });
    }

    const lookupSql = email
      ? 'SELECT id FROM users WHERE email = $1'
      : 'SELECT id FROM users WHERE mobile = $1';
    const userResult = await client.query(lookupSql, [target]);
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: email ? 'No account found for this email.' : 'No account found for this mobile number.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(String(new_password), salt);
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, userResult.rows[0].id]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('forgotPasswordReset error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  } finally {
    client.release();
  }
};

