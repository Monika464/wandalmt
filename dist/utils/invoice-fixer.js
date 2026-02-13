// utils/invoice-fixer.js
import Stripe from "stripe";
import Order from "../models/order.js";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
export async function fixMissingInvoices() {
    try {
        // Znajdź zamówienia z requireInvoice: true ale bez invoiceId
        const ordersWithoutInvoice = await Order.find({
            requireInvoice: true,
            status: "paid",
            $or: [
                { invoiceId: { $exists: false } },
                { invoiceId: null },
                { invoiceId: "" },
            ],
        }).limit(50); // Ogranicz do 50 na raz
        console.log(`Found ${ordersWithoutInvoice.length} orders without invoices`);
        for (const order of ordersWithoutInvoice) {
            if (!order.stripePaymentIntentId) {
                console.log(`Order ${order._id} has no payment intent ID`);
                continue;
            }
            try {
                // Szukaj faktur dla tego payment_intent
                const invoices = await stripe.invoices.list({
                    payment_intent: order.stripePaymentIntentId,
                    limit: 1,
                });
                if (invoices.data.length > 0) {
                    const invoice = invoices.data[0];
                    order.invoiceId = invoice.id;
                    order.invoiceDetails = {
                        invoiceNumber: invoice.number || `INV-${order._id.toString().slice(-8)}`,
                        invoicePdf: invoice.invoice_pdf || "",
                        hostedInvoiceUrl: invoice.hosted_invoice_url || "",
                        status: invoice.status || "paid",
                        amountPaid: invoice.amount_paid
                            ? invoice.amount_paid / 100
                            : order.totalAmount,
                        createdAt: invoice.created
                            ? new Date(invoice.created * 1000)
                            : new Date(),
                    };
                    await order.save();
                    console.log(`✅ Fixed invoice for order ${order._id}: ${invoice.id}`);
                }
                else {
                    console.log(`⚠️ No invoice found for order ${order._id}`);
                }
            }
            catch (error) {
                console.error(`Error fixing invoice for order ${order._id}:`, error.message);
            }
        }
        console.log("Invoice fix completed");
    }
    catch (error) {
        console.error("Error in fixMissingInvoices:", error);
    }
}
