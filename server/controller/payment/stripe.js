const stripe = require('stripe')('sk_test_51MeI7CSDUyu93geHEdL2AgZsA0YjnzYiVCIcyynUFuIepucdPh1ay1vUffVCpZV7xt6nF4NJ2UMofvMAa83StYYT005toxsYYx');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const YOUR_DOMAIN = 'https://techyroots.com:6003/api';
const Validator = require("../../helpers/validators")
const { isUserExists } = require("../user/user");
const planModel = require("../../models/planModel");
const userModel = require("../../models/userModel");
const paymentModel = require("../../models/paymentModel")
dotenv.config();

const ObjectId = mongoose.Types.ObjectId;

const createStripePayUrl = async(userId, planName, orderId, amount) => {
  try{
    const customer = await stripe.customers.create({
      metadata: {
        userId: userId,
        cart: JSON.stringify([
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: planName,
                description: planName+" Plan",
                metadata: {
                  id: orderId
                },
              },
              unit_amount: Number(amount) * 100,
            },
            quantity: 1,
          }
        ]),
      },
    });
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: planName,
              description: planName+" Plan",
              metadata: {
                id: orderId
              },
            },
            unit_amount: Number(amount) * 100,
          },
          quantity: 1,
        }
      ],
      mode: 'payment',
      success_url: `${YOUR_DOMAIN}/success`,
      cancel_url: `${YOUR_DOMAIN}/failed`,
      customer:customer.id
    });

    if(session && "url" in session){
      return {success:true, data:session.url}
    }else{
      return {success:false, data:"ERROR"}
    }
  }catch(error){
    return {success:false, data:error.message} 
  }
}
const orderIdGenerator = async() => {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for(let i = 0; i < 15; i++){
      result += characters.charAt(Math.floor(Math.random() * 62));
  }
  result = "order-"+result
  const isOrderIdExist = await paymentModel.find({orderId:result}).countDocuments();
  if(isOrderIdExist > 0){
      return await orderIdGenerator()
  }
  return result;

}

exports.createCheckOutSessionForStripe = async(req, res) => {

  try{
    let data = Validator.checkValidation(req.body);
    if (data['success'] == true) {
        data = data['data'];
    } else {
        return res.status(201).send({ success: false, msg: "Missing field", data: {}, errors: '' });
    }
    if(await isUserExists(req.user.id)){
        if(!Validator.varCharVerification(data.planid)){
            return res.status(203).send({ success: false, msg: "Please select a plan first", data: {}, errors: "" });
        }else{
            const plan= await planModel.find({_id:ObjectId(`${data.planid}`)});
            console.log(plan)
            if(plan.length == 1){
                const userDetails = await userModel.findOne({_id:ObjectId(`${req.user.id}`)})
                const orderId = await orderIdGenerator();
                // const country = countryCodes.find(country => country.dial_code === userDetails.countryCode);

                const paymentData = new paymentModel({
                    planId: plan[0]._id,
                    userId: req.user.id,
                    orderId: orderId,
                    amount:plan[0].price,
                    actuallyPaid:0,
                    status:"INITIATED",
                    paymentMethod: "Stripe",
                })
                paymentData.save().then(async(isSaved)=>{
                    if(isSaved){
                        const isLinkCreated = await createStripePayUrl(req.user.id, plan[0].planType, orderId, plan[0].price);
                        if(!isLinkCreated.success){
                            return res.status(203).send({success:false, msg:"Can't process your request now please try gain later", errors:isLinkCreated.data})
                        }else{
                          return res.status(200).send({ success: true, msg: "Success", data: isLinkCreated.data, errors: '' });
                        }
                    }else{
                        return res.status(203).send({success:false, msg:"Can't process your request now please try gain later", errors:""})
                    }
                }).catch((error)=>{
                    return res.status(203).send({success:false, msg:"Can't process your request now please try gain later", errors:""}) 
                })
                
            }
            
        }
        
    }
  }catch(error){
      console.log("error" , error);
      return res.status(203).send({success:false, msg:"Can't process your request now please try gain later", errors:""}) 
  }

}


exports.stripeWebHook = async (req, res) => {
  try {
    // Check if webhook signing is configured.
    let webhookSecret = "whsec_yuUnjHU6iGSneYOUw0SrZOKa4YSFgy5D";
    if (webhookSecret) {
      // Retrieve the event by verifying the signature using the raw body and secret.
      let signature = req.headers["stripe-signature"];
      try {
        let event = stripe.webhooks.constructEvent(
          req.rawBody,
          signature,
          webhookSecret
        );
        let data = event.data.object;
        let eventType = event.type;
        // Handle the checkout.session.completed event
        if(eventType){
          const customer = await stripe.customers.retrieve(data.customer);
          const cart = JSON.parse(customer.metadata.cart);
          const orderId = cart[0].price_data.product_data.metadata.id;
          const amount = cart[0].price_data.unit_amount;
          if (eventType === "checkout.session.completed") {
            const updatePayment = await paymentModel.findOneAndUpdate({orderId : data.resource.reference}, {status:"FINISHED", actuallyPaid:amount});
          }else if (eventType === "checkout.session.async_payment_failed") {
            const updatePayment = await paymentModel.findOneAndUpdate({orderId : data.resource.reference}, {status:"FAILED", actuallyPaid:amount});
          }else if (eventType === "checkout.session.async_payment_succeeded") {
            const updatePayment = await paymentModel.findOneAndUpdate({orderId : data.resource.reference}, {status:"FINISHED", actuallyPaid:amount});
          }else if (eventType === "checkout.session.expired") {
            const updatePayment = await paymentModel.findOneAndUpdate({orderId : data.resource.reference}, {status:"EXPIRED", actuallyPaid:amount});
          }
  
          res.status(200).end();
        }
        
      } catch (err) {
        console.log(`⚠️  Webhook signature verification failed:  ${err}`);
        return res.sendStatus(400);
      }
    } else {
      return res.status(203).send({success:false, msg:"unauthorized", data:"", errors:""})
    }
  } catch (error) {
    console.log(error);
  }
};