import mongoose from "mongoose";
const { Schema } = mongoose;

interface IProduct extends Document {
  title: string;
  price: number;
  description: string;
  imageUrl: string;
  content: string;
  userId: mongoose.Types.ObjectId;
}

const productSchema = new Schema<IProduct>({
  title: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
});

const Product = mongoose.model("Product", productSchema);

export default Product;

// import fs from "fs";
// import path from "path";
// import p from "../utils/path.js";
// import Cart from "./cart.js";

// //const products = [];
// const pa = path.join(p, "data", "products.json");

// const getProductFromFile = (cb) => {
//   //const pa = path.join(p, "data", "products.json");
//   fs.readFile(pa, (err, fileContent) => {
//     if (err) {
//       cb([]);
//     } else {
//       cb(JSON.parse(fileContent));
//     }
//   });
// };

// export default class Product {
//   constructor(id, title, imageUrl, description, price) {
//     this.id = id;
//     this.title = title;
//     this.imageUrl = imageUrl;
//     this.description = description;
//     this.price = price;
//   }

//   save() {
//     getProductFromFile((products) => {
//       console.log("products", products);
//       if (this.id) {
//         const existingProductIndex = products.findIndex(
//           (p) => p.id === this.id
//         );
//         const updatedProducts = [...products];
//         updatedProducts[existingProductIndex] = this;
//         // Zapisz zaktualizowane produkty do pliku
//         fs.writeFile(pa, JSON.stringify(updatedProducts), (err) => {
//           if (err) {
//             console.log(err);
//           } else {
//             console.log("Produkt zaktualizowany");
//           }
//         });
//       } else {
//         this.id = Math.random().toString();
//         products.push(this);
//         fs.writeFile(pa, JSON.stringify(products), (err) => {
//           err ? console.log(err) : console.log("success");
//         });
//       }
//     });
//   }

//   static fetchAll(cb) {
//     getProductFromFile(cb);
//   }

//   static findById(id, cb) {
//     getProductFromFile((products) => {
//       const product = products.find((p) => p.id === id);
//       cb(product);
//     });
//   }

//   static deleteById(id) {
//     getProductFromFile((products) => {
//       const product = products.find((prod) => prod.id === id);
//       const updatedProducts = products.filter((prod) => prod.id !== id);
//       fs.writeFile(pa, JSON.stringify(updatedProducts), (err) => {
//         if (err) {
//           console.log(err);
//         } else {
//           Cart.deleteProduct(id, product.price);
//         }
//       });
//     });
//   }
// }
