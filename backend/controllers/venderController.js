const Product = require("../models/productModel");
const User = require("../models/userModel");
const Vender = require("../models/vendorModel");
const ErrorHander = require("../utils/errorhander");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const sendToken = require("../utils/jwtToken");

// Create Product -- Vender
exports.createProduct = catchAsyncErrors(async (req, res, next) => {
  let images = [];

  for (let i = 0; i < req.files.length; i++) {
    images.push(req.files[i].filename);
  }

  const imagesLinks = [];

  for (let i = 0; i < images.length; i++) {
    imagesLinks.push({
      public_id: images[i],
      url: `${process.env.IMAGE_BASE_URL}/${images[i]}`,
    });
  }

  req.body.images = imagesLinks;
  req.body.user = req.user.id;

  const product = await Product.create(req.body);

  res.status(201).json({
    success: true,
    product,
  });
});

// Fetch Product By Vender
exports.singleVenderProducts = catchAsyncErrors(async (req, res, next) => {
  const { venderId } = req.params;

  let venderProduct = await Product.aggregate([
    {
      $match: { _id: venderId },
    },
    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: "$category",
    },
    {
      $project: {
        _id: 1,
        name: 1,
        price: 1,
        ratings: 1,
        review: 1,
        category: "$category.parentCategory",
      },
    },
  ]);

  res.status(200).json({
    venderProduct,
  });
});

// Register Vender
exports.registerVender = catchAsyncErrors(async (req, res, next) => {
  const { name, email, phone, password } = req.body;

  const user = await User.create({
    name,
    email,
    phone,
    password,
    role: "vender",
  });

  const vender = await Vender.create({
    user: user._id,
  });

  sendToken(user, 201, res);
});

// Login Vender
exports.venderLogin = catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorHander("Please Enter Email & Password", 400));
  }

  const vender = await User.findOne({ email }).select("+password");

  if (!vender) {
    return next(new ErrorHander("Invalid email or password", 401));
  }

  const isPasswordMatched = await vender.comparePassword(password);

  if (!isPasswordMatched) {
    return next(new ErrorHander("Invalid email or password", 401));
  }

  sendToken(vender, 200, res);
});

// Get All Vender - Admin
exports.getAllVender = catchAsyncErrors(async (req, res, next) => {
  const venders = await User.find({ role: "vender" });

  res.status(200).json({ success: true, venders });
});

// Get Single Vender Details - Admin
exports.singleVender = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const vender = await User.findById(id);

  if (!vender) return next(new ErrorHander("Vender Not Found !", 401));

  res.status(200).json({
    success: true,
    vender,
  });
});

// Get Vender Details (me)
exports.getVenderDetails = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  const vender = await User.findById(id);

  if (!vender) return next(new ErrorHander("Vender Not Found ! Invalid id"));

  res.status(200).json({
    success: true,
    vender,
  });
});

// Update Vender Detail
exports.updateVender = catchAsyncErrors(async (req, res, next) => {
  const newUserData = {
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
  };

  const vender = await User.findByIdAndUpdate(req.user.id, newUserData, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });

  res.status(200).json({
    success: true,
  });
});

// Change Vender Status - Admin
exports.changeVenderStatus = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  const user = await User.findById(id);

  const vender = await Vender.findOne({ user: user._id });

  if (!vender) return next(new ErrorHander("Vender Not Found ! Invalid Id"));

  vender.isVerified = !vender.isVerified;

  vender.save();

  res
    .status(200)
    .json({ success: true, message: "Status Updated Successfully" });
});
