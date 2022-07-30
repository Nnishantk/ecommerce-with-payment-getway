const ErrorHander = require("../utils/errorhander");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const User = require("../models/userModel");
const Otp = require("../models/otpModel")
const sendToken = require("../utils/jwtToken");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");
const cloudinary = require("cloudinary");
const { OAuth2Client } = require("google-auth-library");
const { sendSMS, verifySMS } = require("../utils/sendOTP");
const otpHelper = require("../utils/otp");
const { singleFileHandle} = require("../utils/fileHandle");
// Google O Auth

exports.signInWithGoogle = catchAsyncErrors(async (req, res, next) => {
  const googleClient = new OAuth2Client({
    clientId: `${process.env.GOOGLE_CLIENT_ID}`,
  });

  const { token } = req.body;

  const ticket = googleClient.verifyIdToken({
    idToken: token,
    audience: `${process.env.GOOGLE_CLIENT_ID}`,
  });

  const payload = ticket.getPayload();

  const user = await User.findOne({ email: payload?.email });

  if (!user) {
    const newUser = await User.create({
      name: payload?.name,
      email: payload?.email,
    });
    sendToken(newUser, 201, res);
  }
  sendToken(user, 201, res);
});

// Register a User
exports.registerUser = catchAsyncErrors(async (req, res, next) => {
  const { name, phone, password,role} = req.body;

  console.log(name, phone, password)
  const user = await User.create({
    name,
    phone,
    password,
    role
  });
  console.log(user)
  const otp = await sendOtp(user, "account_verification");

  res.status(201).json({
    success: true,
    msg: "opt sent to your phone",
    otp
  })
});

// Facebook Authentication

exports.signInWithFacebook = catchAsyncErrors(async (req, res, next) => {});

// Send OTP

// exports.sendOTP = catchAsyncErrors(async (req, res, next) => {
//   const { phone } = req.body;

//   const response = await sendSMS(phone);

//   if (response.error) return next(new ErrorHander(response.error, 500));

//   res.status(200).json({ message: "OTP Sent !", response });
// });

const sendOtp = async (user, otpType) => {
  try{
    await Otp.findOneAndDelete({user: user._id});
    const otp = await otpHelper.generateOTP(5);
    await Otp.create({
      user: user._id,
      otp: otp,
      type: otpType
    });
    sendSMS(user.phone, `otp is ${otp}`);
    return otp;
  } catch (error) {
    throw error;
  }
}

// Verify OTP

exports.accountVerificationOTP = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findOne({
    phone: req.body.phone
  })

  console.log("user",user)
  if(!user) {
    return next(new ErrorHander("Invalid OTP!", 400))
  }
  console.log(Date.now())
  const verify = await Otp.findOne({
    user: user._id,
    otp: req.body.otp,
    expires: {$gt: Date.now()}
  });
  if(!verify) {
    return next(new ErrorHander("Invalid OTP!", 400))
  }
  await Otp.findByIdAndDelete(verify._id);
  user.verified = true;
  await user.save();
  
  sendToken(user, 201, res);
});

// Login User
exports.loginUser = catchAsyncErrors(async (req, res, next) => {
  const {phone, password } = req.body;

  if (!phone || !password) {
    return next(new ErrorHander("Please Enter Email & Password", 400));
  }

  const user = await User.findOne({ phone}).select(
    "+password"
  );

  if (!user) {
    return next(new ErrorHander("Invalid email or password", 401));
  }

  if(!user.verified){
    const otp = await sendOtp(user, "account_verification");

    return res.status(201).json({
      success: true,
      accountVerified: user.verified,
      msg: "Account not verified!!! Otp sent to your phone",
      otp
    })
  }
  const isPasswordMatched = await user.comparePassword(password);

  if (!isPasswordMatched) {
    return next(new ErrorHander("Invalid email or password", 401));
  }

  sendToken(user, 200, res);
});

// Logout User
exports.logout = catchAsyncErrors(async (req, res, next) => {
  res.cookie("token", null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: "Logged Out",
  });
});

// Forgot Password
exports.forgotPassword = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findOne({phone: req.body.phone});
  let otp;

  if(!user){
    next(new ErrorHander("user with phone numebr not registered", 400))
  }

  otp = await sendOtp(user, "password_reset");

  return res.status(200).json({
    success: true,
    msg: "opt sent to your phone",
    otp
  })
})

exports.passwordResetOtp = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findOne({phone: req.body.phone});

  if(!user) {
    return next(new ErrorHander("Invalid OTP!", 400))
  }

  const otpDoc = await Otp.findOne({
    user: user._id,
    otp: req.body.otp,
    expires: {$gt: Date.now()},
    type: "password_reset"
  });

  if(!otpDoc){
    return next(new ErrorHander("Invalid OTP!", 400));
  }

  await Otp.findByIdAndDelete(otpDoc._id);

  const resetToken = user.getResetPasswordToken();

  await user.save({ validateBeforeSave: false });

  return res.status(200).json({
    resetToken
  })

})
// exports.forgotPassword = catchAsyncErrors(async (req, res, next) => {
//   const user = await User.findOne({ email: req.body.email });

//   if (!user) {
//     return next(new ErrorHander("User not found", 404));
//   }

//   const resetToken = user.getResetPasswordToken();

//   await user.save({ validateBeforeSave: false });

//   const resetPasswordUrl = `${req.protocol}://${req.get(
//     "host"
//   )}/password/reset/${resetToken}`;

//   const message = `Your password reset token is :- \n\n ${resetPasswordUrl} \n\nIf you have not requested this email then, please ignore it.`;

//   try {
//     await sendEmail({
//       email: user.email,
//       subject: `Flyweis - Password Recovery Mail`,
//       message,
//     });

//     res.status(200).json({
//       success: true,
//       message: `Email sent to ${user.email} successfully`,
//     });
//   } catch (error) {
//     user.resetPasswordToken = undefined;
//     user.resetPasswordExpire = undefined;

//     await user.save({ validateBeforeSave: false });

//     return next(new ErrorHander(error.message, 500));
//   }
// });

// Reset Password
exports.resetPassword = catchAsyncErrors(async (req, res, next) => {
  // creating token hash
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.body.resetToken)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(
      new ErrorHander(
        "Reset Password Token is invalid or has been expired",
        400
      )
    );
  }

  if (req.body.password !== req.body.confirmPassword) {
    return next(new ErrorHander("Password does not password", 400));
  }

  user.password = req.body.password;
  user.verified = true;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  sendToken(user, 200, res);
});

// Get User Detail
exports.getUserDetails = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  // const ref = await Referral.find({ user: req.user.id });

  res.status(200).json({
    success: true,
    user,
    // wallet: ref[0],
  });
});

// update User password
exports.updatePassword = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");

  const isPasswordMatched = await user.comparePassword(req.body.oldPassword);

  if (!isPasswordMatched) {
    return next(new ErrorHander("Old password is incorrect", 400));
  }

  if (req.body.newPassword !== req.body.confirmPassword) {
    return next(new ErrorHander("password does not match", 400));
  }

  user.password = req.body.newPassword;

  await user.save();

  sendToken(user, 200, res);
});

// update User Profile
exports.updateProfile = catchAsyncErrors(async (req, res, next) => {
req.body.image = `${process.env.IMAGE_BASE_URL}/${req.file.filename}`
 const imagesLinks = await multipleFileHandle(req.files,req);

const newUserData = {
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
   
  };

  const user = await User.findByIdAndUpdate(req.user.id, newUserData, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });

  res.status(200).json({
    success: true,
  });
});

// Get all users(admin)
exports.getAllUser = catchAsyncErrors(async (req, res, next) => {
  const users = await User.find();

  res.status(200).json({
    success: true,
    users,
  });
});

// Get single user (admin)
exports.getSingleUser = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(
      new ErrorHander(`User does not exist with Id: ${req.params.id}`)
    );
  }

  res.status(200).json({
    success: true,
    user,
  });
});

// update User Role -- Admin
exports.updateUserRole = catchAsyncErrors(async (req, res, next) => {
  const newUserData = {
    name: req.body.name,
    email: req.body.email,
    role: req.body.role,
  };

  await User.findByIdAndUpdate(req.params.id, newUserData, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });

  res.status(200).json({
    success: true,
  });
});

// Delete User --Admin
exports.deleteUser = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(
      new ErrorHander(`User does not exist with Id: ${req.params.id}`, 400)
    );
  }

  const imageId = user.avatar.public_id;

  await cloudinary.v2.uploader.destroy(imageId);

  await user.remove();

  res.status(200).json({
    success: true,
    message: "User Deleted Successfully",
  });
});
