// Jared Rosenlund 
// Michael Hutchings
// Adam Ross
// Ryan Ward
// Section 2
// Group 1

// This program is specifically for Adam's mom, Cathy Ross, aimed towards helping people with dietary restrictions.
// The deployed website allows the user to create an account, log in, and manage their account.
// The website allows any user to view existing recipes, however only logged in users and create lists and add recipes to those lists.  

// We import the modules we need to run our application and user funcitonality

const express = require("express");
const session = require("express-session");
const { readSync } = require("fs");

let app = express();

let path = require("path");

const port = process.env.PORT || 3000;

app.set("view engine", "ejs");

app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.text());

// We connect to our local machine and to the RDS when deployed

const knex = require("knex")({
  client: "pg",
  connection: {
    host: process.env.RDS_HOSTNAME || "localhost",
    user: process.env.RDS_USERNAME || "postgres",
    password: process.env.RDS_PASSWORD || "Kayla1sMyL0v3!",
    database: process.env.RDS_DB_NAME || "Cathy's Cookbook",
    port: process.env.RDS_PORT || 5432,
    ssl: process.env.DB_SSL ? { rejectUnauthorized: false } : false,
  },
});

// Login function, called in login post method
async function getUserFromDatabase(Username, Password) {
  try {
    // Pull record from database where user and password match entered value
    // Set returned value as user object
    const user = await knex("user")
    .select(
      "user.username",
      "user.userfirstname",
      "user.userlastname",
      "user.email",
      "user.isadmin",
      "user.userid",
      "user_passwords.username as up_username",
      "user_passwords.password as up_password"
    )
    .join("user_passwords", "user.username", "user_passwords.username")
    .where({
      "user_passwords.username": Username,
      "user_passwords.password": Password,
    });


    // If user object is not null, return the user; otherwise return null
    if (user) {
      return user;
    } else {
      return null;
    }
  } catch (error) {
    // Error handling
    console.error("Error retrieving user from the database:", error);
    throw error;
  }
}

// Get request for rendering the login view

app.get("/login", (req, res) => {
  res.render("login", { title: "Sign In", errorMessage: "", user: req.session.user });
});

// Post method for logging in a user with error handling functionality

app.post("/login", async (req, res) => {
  try {
    // Pass form values to getUser function, set returned value as user object
    const user = await getUserFromDatabase(req.body.username, req.body.password);
    console.log(user);

    // Check if user is null
    if (user.length > 0) {
      // On successful login, session user set as user object and redirects to landing page
      req.session.user = user;
      res.redirect("/");
    } else {
      // On failed login, send error message
      res.render("login", {
        errorMessage: "Invalid credentials, please try again.",
        user: req.session.user
      });
    }
    // Error handling
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Get method for logging out and returning to the landing page

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session: ", err);
    } else {
      res.redirect("/");
    }
  });
});

// Get request for our root/landing page

app.get("/", (req, res) => {
  res.render("index", { title: "index", user: req.session.user});
});

// Get request for about page 

app.get("/about", (req, res) => {
  res.render("about", { title: "about", user: req.session.user });
});

// Get request for adding a recipe view

app.get("/addRecipe", (req, res) => {
  if (req.session.user) {
    res.render("addRecipe", { title: "Add Recipe", user: req.session.user });
  } else {
    res.redirect("/login");
  }
});

// Post request for adding a recipe

app.post('/addRecipe', async (req, res) => {
  const ingredients = [];
  console.log("This is the request body: ", req.body)

  // Loop through the request body to gather ingredients
  for (let i = 1; i <= parseInt(req.body.ingredientCounter); i++) {
    // Check if both name and quantity are present to consider it a valid ingredient
    const ingredient = {
      "ingredientid": req.body['ingredient' + i],
      "measureamountid": req.body['unit' + i],
      "amount" : req.body['quantity' + i]
    };
    ingredients.push(ingredient);
  }

  try {
    // Get the max recipe ID
    const result = await knex("recipes").max("recipeid as maxField");
    const newRecipeID = result[0].maxField + 1;

    // Insert into recipes table
    await knex("recipes").insert({
      "recipeid" : newRecipeID,
      "recipetitle" : req.body.recipeName,
      "recipeclassid" : req.body.recipeClass,
      "preparation" : req.body.preparation,
      "notes" : req.body.notes
    });

    // Insert into recipe_ingredients table
    for (let iCount = 0; iCount < ingredients.length; iCount++) {
      await knex("recipe_ingredients").insert({
        "recipeid" : newRecipeID,
        "recipeseqno" : iCount + 1,
        "ingredientid": ingredients[iCount].ingredientid,
        "measureamountid" : ingredients[iCount].measureamountid,
        "amount" : ingredients[iCount].amount
      });
    }

    res.redirect("/login");
  } catch (error) {
    console.error("Error in query:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Get request for the search recipes view

app.get("/search", (req, res) => {
  knex("recipes")
  .select("recipetitle","recipeid")
  .then((result) => {
  res.render("search", { title: "search", user: req.session.user, recipeList: result, errorMessage: "" });
    });
});

// Post method for searching recipes

app.post("/search", (req, res) => {
  console.log("This is the search request body: ", req.body)
  console.log("This is the req.body: ", req.body.recipeid)
  const recipeid = req.body.recipeid;
  console.log("recipeid: ", recipeid)
  
  // Check if recipeid is provided
  if (recipeid) {;
    console.log("dropped into the if statement")
    // Fetch ingredients to load recipe view
    knex
      .select('ingredientname', 
              'amount', 
              'measurementdescription',
              'recipetitle',
              'preparation',
              'notes',
              'recipes.recipeid')
      .from('recipes')
      .join('recipe_ingredients', 'recipes.recipeid', 'recipe_ingredients.recipeid')
      .join('ingredients', 'recipe_ingredients.ingredientid', 'ingredients.ingredientid')
      .join('measurements', 'recipe_ingredients.measureamountid', 'measurements.measureamountid')
      .where({'recipes.recipeid' : recipeid})
      // Execute both queries
      .then((recipeIngredients) => {

        knex
        .select('listid','listname','ownerid')
        .from('lists')
        .then((allLists) => {
        res.render("recipes", {
          user: req.session.user,
          recipeQuery : recipeIngredients,
          userList : allLists,
          errorMessage : ''
        });

      })


    })
    .catch(error => {
      // Handle errors more gracefully (e.g., send an error response to the client)
      console.error('Error executing queries:', error);
    })
    } else {
      // Handle the case when recipeid is not provided

      knex("recipes")
      .select("recipetitle","recipeid")
      .then((result) => {
      res.render("search", { title: "search", user: req.session.user, recipeList: result, errorMessage: "Please select a valid recipe" });
      }); 
    }
})

// Get request for the search recipes through api view

app.get("/searchapi", (req, res) => {
  res.render("searchapi", { title: "search", user: req.session.user, errorMessage: "" });
});

// Get request for view to add a new user

app.get("/newUser", (req, res) => {
  res.render("newUser", { title: "Create Account", user: req.session.user, errorMessage: ""});
});

app.post("/newUser", (req, res) => {
  console.log(req.body);
  const newUsername = req.body.username;

  // Check if the username already exists
  knex("user")
      .select("username")
      .where({ username: newUsername })
      .then(async existingUser => {
          if (existingUser.length > 0) {
              // Username already exists, handle the error
              res.render("newUser", { user:req.session.user,errorMessage: "Username already exists. Please choose a different username." });
          } else {
              console.log("This is the request body for creating a new user: ",req.body);
              // Username is unique, proceed with insertion
              await knex("user")
              .insert({
                  "username": newUsername,
                  "userfirstname": req.body.fname,
                  "userlastname": req.body.lname,
                  "email": req.body.email,
                  "isadmin": 'false'
              })
              await knex("user_passwords")
              .insert({
                  "username": newUsername,
                  "password": req.body.password
              })
              .catch(error => {
                  // Handle other potential errors during insertion
                  res.status(500).send("Internal Server Error");
              });
              console.log("made it through creation: ",req.body);

              const newUser = await getUserFromDatabase(newUsername,req.body.password);
              console.log(newUser)
              req.session.user = newUser;
            
              res.render("index", {  user: req.session.user });

              
          }
      })
      .catch(error => {
          // Handle errors during username existence check
          res.status(500).send("Internal Server Error");
      });
});

// Get request for the view for users to manage their account 

app.get("/manageAccount", (req, res) => {
   if (req.session.user) {
    console.log("Username: ",req.session.user[0].username);
    console.log("Password: ",req.session.user[0].password);
    knex("user")
    .select(
      "user.username",
      "user.userfirstname",
      "user.userlastname",
      "user.email",
      "user.isadmin",
      "user_passwords.username as up_username",
      "user_passwords.password as up_password"
    )
    .join("user_passwords", "user.username", "user_passwords.username")
    .where({
      "user_passwords.username": req.session.user[0].up_username,
      "user_passwords.password": req.session.user[0].up_password
    })
      .then((user) => {
        res.render("manageAccount", { userList: user, user: req.session.user });
      });
  } else {
    res.redirect("/login");
  }
});

// Get request for the edit user view

app.get("/editUser/:USERNAME", (req, res) => {
  if (req.session.user) {
    knex
    knex("user")
    .select(
      "user.username",
      "user.userfirstname",
      "user.userlastname",
      "user.email",
      "user.isadmin",
      "user_passwords.username as up_username",
      "user_passwords.password as up_password"
    )
    .join("user_passwords", "user.username", "user_passwords.username")
      .where({ "user_passwords.username": req.params.USERNAME })
      .then((entry) => {
        res.render("editUser", {
          user: req.session.user,
          userList: entry,
          editActiveUsername: req.params.USERNAME,
        });
      });
  } else {
    res.redirect("/login");
  }
});

// Post request for updating a user's account

app.post("/editUser",async (req, res) => {
  await knex("user").where({ username : req.body.editActiveUsername }).update({
    username: req.body.editUserName,
    userfirstname: req.body.editFirstName,
    userlastname: req.body.editLastName,
    email: req.body.editEmail,
  });
  await knex("user_passwords")
    .where({ username: req.body.editActiveUsername })
    .update({
      username: req.body.editUserName,
      password: req.body.editPassword
    })
    .catch((error) => {
      console.error("Error updating user:", error);
      res.status(500).send("Internal Server Error");
    })
    .then(() => {
      console.log("Session user and password was: ", req.body.editUserName,req.body.editPassword);
      req.session.user.username = req.body.editUserName;
      req.session.user.up_username = req.body.editUserName;
      req.session.up_password = req.body.editPassword;
      console.log("Session user and password is now: " + req.session.user[0].username, req.session.user[0].password);
      console.log("Body: " + req.body.editUserName);
    
     knex("user")
      .select(
        "user.username",
        "user.userfirstname",
        "user.userlastname",
        "user.email",
        "user.isadmin",
        "user_passwords.username as up_username",
        "user_passwords.password as up_password"
      )
      .join("user_passwords", "user.username", "user_passwords.username")
      .where({
        "user_passwords.username": req.body.editUserName,
        "user_passwords.password": req.body.editPassword
      })
        .then(async (user) => {
          res.render("manageAccount", { userList: user, user: req.session.user });
        });
    })
  });

// Post method for deleting a user 

app.post("/deleteUser/:userid", (req, res) => {
  console.log("You made it through the function to the server");
  try {
    const userid = req.params.userid;
    console.log("this is the user that the server sees:" + userid);
    knex("USERS")
      .where({ USERNAME: userid })
      .del()
      .then(async() => {
        console.log("the delete worked!");

        if (req.session.user[0].USERNAME == "Admin") {
          knex
            .select(
              "username",
              "userfirstname",
              "userlastname",
              "email",
              "isadmin"
            )
            .join("user_passwords", "users.username", "user_passwords.username")
            .from("users")
            .then(async (entry) => {
              res.render("manageAccount", {
                entryList: entry,
                user: req.session.user,
              });
            });
        } else {
          req.session.destroy((err) => {
            if (err) {
              console.error("Error destroying session: ", err);
            } else {
              res.redirect("/");
            }
          });
        }
      });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Error deleting the account" });
  }
});

// Post method for deleting a list

app.post("/deleteList/:listid", (req, res) => {
  console.log("You made it through the function to the server");
  try {
    const listID = req.params.listid;
    console.log("this is the user that the server sees:" + listID);
    knex("lists")
      .where({ listid : listID })
      .del()
      .then(() => {
        knex("recipe_lists")
        .where({ listid : listID })
        .del()
        .then(() => {
        
        knex("lists")
  .select("ownerid",
          "listid",
          "listname")
          .where({ownerid : req.session.user[0].userid})
  .then(async(lists) => {
    res.render("myLists", {
      userList: lists,
      user: req.session.user
    });
  })
      
      });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Error deleting the list" });
  }
});

// Post method for removing a recipe from a list

app.post("/removeRecipe", (req, res) => {
  console.log("You made it through the function to the server");
  try {
    const recipeToDelete = req.body.recipeToRemove;
    console.log("this is the recipe on the chopping block:" + recipeToDelete);
    knex("recipe_lists")
      .where({ recipeid: recipeToDelete })
      .del()
      .then(() => {
        console.log("the delete worked!");
        knex.select("*").from("recipes").join("recipe_lists", "recipes.recipeid", "recipe_lists.recipeid")
  .join("recipe_classes", "recipes.recipeclassid", "recipe_classes.recipeclassid").where({"recipe_lists.listid" : req.body.listid})
        .then(async(recipes) => {
          res.render("listContents", {
            recipeList: recipes,
            user: req.session.user,
            listid : req.body.listid,
            listName : req.body.listName

    });
  })
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Error deleting the list" });
  }
});

// Get request for a user to access a view that has their lists

app.get("/myLists", (req, res) => {
  if (req.session.user) {
  
      knex("lists")
      .select("ownerid",
              "listid",
              "listname")
      .where("ownerid", req.session.user[0].userid)
      .then((lists) => {
        res.render("myLists", {
          userList: lists,
          user: req.session.user
        });
      })
  }
  else{
    res.redirect("/login");
  }
})

// Post request to add a list

app.post("/addList", (req, res) => {
  console.log("This is the req body: ", req.body);
  knex("lists").insert({
    ownerid: req.session.user[0].userid,
    listname: req.body.newList
  }).then(() =>
        knex("lists")
        .select("ownerid",
                "listid",
                "listname")
        .where("ownerid", req.session.user[0].userid)
        .then((lists) => {
          res.render("myLists", {
            userList: lists,
            user: req.session.user
          });
        })
  )
  .catch((error) => {
    console.error("Error:", error);
  })
});

// Get request that displays a view which shows one individual list

app.get("/list/:LISTID/:LISTNAME", (req, res) => {
  if (req.session.user) {
    console.log("This is the request body and the paramters to get an individual view: ",req.params)
    const viewList = parseInt(req.params.LISTID);
    const ListName = req.params.LISTNAME;

    knex.select("*").from("recipes").join("recipe_lists", "recipes.recipeid", "recipe_lists.recipeid")
    .join("recipe_classes", "recipes.recipeclassid", "recipe_classes.recipeclassid").where({"recipe_lists.listid" : viewList})
    .then((recipes) => {
      res.render("listContents", {
        recipeList: recipes,
        user: req.session.user,
        listid : viewList,
        listName : ListName
      });
    })
    
  }
  else{
    res.redirect("/login");
  }
    
})

// Get request that renders a view which can be accessed to view one individual recipe

app.get("/recipes/:RECIPEID", (req, res) => {
  console.log("This is to get a recipe, the request parameter are:" , req.params)
  const recipeId = parseInt(req.params.RECIPEID);

  // Fetch ingredients
  knex
    .select('ingredientname', 
            'amount', 
            'measurementdescription',
            'recipetitle',
            'preparation',
            'notes',
            'recipes.recipeid')
    .from('recipes')
    .join('recipe_ingredients', 'recipes.recipeid', 'recipe_ingredients.recipeid')
    .join('ingredients', 'recipe_ingredients.ingredientid', 'ingredients.ingredientid')
    .join('measurements', 'recipe_ingredients.measureamountid', 'measurements.measureamountid')
    .where({'recipes.recipeid': recipeId})



  // Execute both queries
    .then((recipeIngredients) => {

      knex
      .select('listid','listname','ownerid')
      .from('lists')
      .then((allLists) => {
      res.render("recipes", {
        user: req.session.user,
        recipeQuery : recipeIngredients,
        userList : allLists,
        errorMessage : ''
      });

      })


    })
    .catch(error => {
      // Handle errors more gracefully (e.g., send an error response to the client)
      console.error('Error executing queries:', error);
    })
});

// Post request to add a recipe to a list

app.post("/addToList",(req,res) =>{
  console.log("This is the request body for adding a recipe to a list: ",req.body,"/n")
  knex("recipe_lists").select("listid","recipeid").where("listid", req.body.listid).andWhere("recipeid", req.body.recipeid)
  .then((result) => {
  if (result.length == 0) {
  knex("recipe_lists")
  .insert({
    listid : req.body.listid,
    recipeid : req.body.recipeid
  }).then(() => {

    const recipeId = req.body.recipeid;

  // Fetch ingredients
  knex
    .select('ingredientname', 
            'amount', 
            'measurementdescription',
            'recipetitle',
            'preparation',
            'notes',
            'recipes.recipeid')
    .from('recipes')
    .join('recipe_ingredients', 'recipes.recipeid', 'recipe_ingredients.recipeid')
    .join('ingredients', 'recipe_ingredients.ingredientid', 'ingredients.ingredientid')
    .join('measurements', 'recipe_ingredients.measureamountid', 'measurements.measureamountid')
    .where('recipes.recipeid', recipeId)



  // Execute both queries
    .then((recipeIngredients) => {

      knex
      .select('listid','listname','ownerid')
      .from('lists')
      .then((allLists) => {
      res.render("recipes", {
        user: req.session.user,
        recipeQuery : recipeIngredients,
        userList : allLists,
        errorMessage : ''
      });

    })
  })
  })
  }
  else
  {
    const recipeId = req.body.recipeid;

  // Fetch ingredients
  knex
    .select('ingredientname', 
            'amount', 
            'measurementdescription',
            'recipetitle',
            'preparation',
            'notes',
            'recipes.recipeid')
    .from('recipes')
    .join('recipe_ingredients', 'recipes.recipeid', 'recipe_ingredients.recipeid')
    .join('ingredients', 'recipe_ingredients.ingredientid', 'ingredients.ingredientid')
    .join('measurements', 'recipe_ingredients.measureamountid', 'measurements.measureamountid')
    .where('recipes.recipeid', recipeId)



  // Execute both queries
    .then((recipeIngredients) => {

      knex
      .select('listid','listname','ownerid')
      .from('lists')
      .then((allLists) => {
      res.render("recipes", {
        user: req.session.user,
        recipeQuery : recipeIngredients,
        userList : allLists,
        errorMessage : "That recipe is already in this list"
      });

    })
  })
  
  }
})
})


// Shopping List
class Meal {
  constructor(name) {
    this.name = name;
    this.ingredients = {};
  }

  addIngredient(ingredient, quantity, unit) {
    this.ingredients[ingredient] = { quantity, unit };
  }
}

async function fetchRecipeFromDatabase(mealName) {
  return knex
    .select('ingredients.ingredientname', 'recipe_ingredients.amount', 'measurements.measurementdescription')
    .from('recipes')
    .join('recipe_ingredients', 'recipes.recipeid', '=', 'recipe_ingredients.recipeid')
    .join('ingredients', 'recipe_ingredients.ingredientid', '=', 'ingredients.ingredientid')
    .join('measurements', 'recipe_ingredients.measureamountid', '=', 'measurements.measureamountid')
    .where('recipes.recipename', mealName);
}

// Listen!

app.listen(port, () => console.log("Server is listening"));
