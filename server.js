const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

// PostgreSQL connection setup
const pool = new Pool({
  user: 'gen_user',
  host: '94.241.138.58',
  database: 'default_db',
  password: 'S>Q=/&vNk2Ab5',
  port: 5432,
});

// Create a new Express application
const app = express();

// Use body-parser to parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Enable CORS
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

const PORT = process.env.PORT || 3000;

// API route for handling user data submission
app.post('/user', async (req, res) => {
    const { user_id, age, height, weight, activityLevel, goal, foodRestrictions, metabolism } = req.body;
    try {
        // Обновляем данные пользователя, включая метаболизм
        await pool.query('UPDATE users SET age = $1, height = $2, weight = $3, activity_level = $4, goal = $5, food_restrictions = $6, metabolism = $7 WHERE user_id = $8', 
                         [age, height, weight, activityLevel, goal, foodRestrictions, metabolism, user_id]);
                // Сохраняем или обновляем формулу метаболизма в таблице diet_plan
        await pool.query('INSERT INTO diet_plan (user_id, formula) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET formula = $2', 
                [user_id, metabolism]);     

        res.status(200).send(`User data updated for user ID: ${user_id}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating user data');
    }
});

app.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        if (result.rows.length > 0) {
            res.status(200).json(result.rows[0]);
        } else {
            res.status(404).send('User not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});


  // API route for handling metabolism data submission
  app.post('/metabolism', async (req, res) => {
    const { user_id, bm, rm1, rm2, im } = req.body;
    try {
      const result = await pool.query('INSERT INTO metabolism_data (user_id, bm, rm1, rm2, im) VALUES ($1, $2, $3, $4, $5) RETURNING metabolism_id', [user_id, bm, rm1, rm2, im]);
      res.status(201).send(`Metabolism data added for user ID: ${user_id}`);
    } catch (err) {
      console.error(err);
      res.status(500).send('Error adding metabolism data');
    }
  });
  
  // API route for handling diet plan data submission
  app.post('/diet-plan', async (req, res) => {
    const { user_id, time_of_day, formula } = req.body;
    try {
      const result = await pool.query('INSERT INTO diet_plan (user_id, time_of_day, formula) VALUES ($1, $2, $3) RETURNING diet_id', [user_id, time_of_day, formula]);
      res.status(201).send(`Diet plan added for user ID: ${user_id}`);
    } catch (err) {
      console.error(err);
      res.status(500).send('Error adding diet plan data');
    }
  });
  
  app.get('/diet-plan/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await pool.query('SELECT formula FROM diet_plan WHERE user_id = $1', [userId]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

app.get('/diet-plan/meals/:userId/:mealDate/:mealType', async (req, res) => {
    const { userId, mealDate, mealType } = req.params;
    console.log(`Received request for meals: userId=${userId}, mealDate=${mealDate}, mealType=${mealType}`);

    let query = `
        SELECT sp.*, p.name, p.mass, p.unit
        FROM selected_products sp
        JOIN products p ON sp.product_id = p.product_id
        JOIN diet_plan dp ON sp.diet_plan_id = dp.diet_id
        WHERE dp.user_id = $1 AND sp.meal_date = $2
    `;

    const values = [userId, mealDate];

    if (mealType !== 'all') {
        query += ` AND sp.meal_type = $3`;
        values.push(mealType); // Добавляем mealType как параметр только если он не равен 'all'
    }

    try {
        const result = await pool.query(query, values);
        if (result.rows.length > 0) {
            res.json(result.rows);
        } else {
            console.log(`No meals found for the given criteria`);
            res.json([]);
        }
    } catch (err) {
        console.error('Error fetching meals:', err);
        res.status(500).send('Server error');
    }
});





app.get('/diet-plan/:dietPlanId', async (req, res) => {
  const { dietPlanId } = req.params;

  try {
      const dietPlan = await pool.query('SELECT * FROM diet_plan WHERE diet_id = $1', [dietPlanId]);
      const selectedProducts = await pool.query('SELECT * FROM selected_products WHERE diet_plan_id = $1', [dietPlanId]);

      res.status(200).json({
          dietPlan: dietPlan.rows[0],
          products: selectedProducts.rows
      });
  } catch (err) {
      console.error(err);
      res.status(500).send('Error retrieving diet plan data');
  }
});



app.post('/diet-plan/:dietPlanId/add-product', async (req, res) => {
  const { dietPlanId } = req.params;
  const { product_id, quantity } = req.body;

  try {
      await pool.query('INSERT INTO selected_products (diet_plan_id, product_id, quantity) VALUES ($1, $2, $3)', 
                       [dietPlanId, product_id, quantity]);
      res.status(201).send(`Product added to diet plan ID: ${dietPlanId}`);
  } catch (err) {
      console.error(err);
      res.status(500).send('Error adding product to diet plan');
  }
});

app.get('/diet-plan/:dietPlanId/meals/:mealDate/:mealType', async (req, res) => {
    const { dietPlanId, mealDate, mealType } = req.params;

    // Здесь должна быть логика выборки данных из базы данных в зависимости от dietPlanId, mealDate и mealType
    try {
        let query;
        const params = [dietPlanId, mealDate];
        if (mealType === 'all') {
            query = 'SELECT * FROM selected_products WHERE diet_plan_id = $1 AND meal_date = $2';
        } else {
            query = 'SELECT * FROM selected_products WHERE diet_plan_id = $1 AND meal_date = $2 AND meal_type = $3';
            params.push(mealType);
        }

        const result = await pool.query(query, params);

        if (result.rows.length > 0) {
            res.json(result.rows);
        } else {
            res.status(404).send('Meals not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

  
app.get('/meals/:userId/:mealDate/:mealType', async (req, res) => {
    const { userId, mealDate, mealType } = req.params;
    let query = `SELECT sp.* FROM selected_products sp JOIN diet_plan dp ON sp.diet_plan_id = dp.diet_id WHERE dp.user_id = $1 AND sp.meal_date = $2`;
    let params = [userId, mealDate];

    if (mealType !== 'all') {
        query += ' AND sp.meal_type = $3';
        params.push(mealType);
    }

    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});
app.get('/selected-products/dates/:diet_plan_id', async (req, res) => {
    const { diet_plan_id } = req.params;
    try {
        const result = await pool.query(
            `SELECT DISTINCT meal_date FROM selected_products WHERE diet_plan_id = $1 ORDER BY meal_date DESC`,
            [diet_plan_id]
        );
        res.json(result.rows.map(row => row.meal_date));
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});


app.delete('/remove-product', async (req, res) => {
    const { product_id } = req.body;

    try {
        await pool.query('DELETE FROM selected_products WHERE product_id = $1', [product_id]);
        res.json({ message: 'Product removed successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});


app.get('/products/:macro', async (req, res) => {
    try {
        const { macro } = req.params;
        const result = await pool.query('SELECT * FROM products WHERE macro = $1', [macro]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

app.get('/product/:productId', async (req, res) => {
  const { productId } = req.params;

  try {
      const result = await pool.query('SELECT * FROM products WHERE product_id = $1', [productId]);
      if (result.rows.length > 0) {
          res.status(200).json(result.rows[0]);
      } else {
          res.status(404).send('Product not found');
      }
  } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
  }
});



  // API route for getting products data
  app.get('/products', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM products');
      res.status(200).json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).send('Error retrieving products data');
    }
  });

  app.post('/update-portion/:selectedProductId', async (req, res) => {
    const { selectedProductId } = req.params;
    const { newQuantity } = req.body;

    try {
        await pool.query('UPDATE selected_products SET quantity = $1 WHERE selected_product_id = $2', [newQuantity, selectedProductId]);
        res.send('Selected portion updated successfully');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.post('/update-diet-plan-formula/:userId', async (req, res) => {
    const { userId } = req.params; // Получение ID пользователя из параметров запроса
    const { formula } = req.body; // Получение новой формулы из тела запроса

    try {
        // Обновление формулы в записи diet_plan для данного пользователя
        const result = await pool.query(
            'UPDATE diet_plan SET formula = $1 WHERE user_id = $2 RETURNING *',
            [formula, userId]
        );

        if (result.rows.length > 0) {
            // Если обновление прошло успешно, отправляем обновленную формулу обратно клиенту
            res.json({ message: 'Formula updated successfully', updatedFormula: result.rows[0].formula });
        } else {
            // Если запись не найдена, возвращаем ошибку
            res.status(404).json({ message: 'Diet plan not found for the given user_id' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error updating diet plan formula' });
    }
});

  
  app.get('/initial-group-portions/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        // Здесь логика запроса к БД для получения начальных порций каждой группы
        const result = await pool.query('SELECT formula FROM diet_plan WHERE user_id = $1', [userId]);
        if (result.rows.length > 0) {
            const formula = result.rows[0].formula;
            // Парсинг formula и создание объекта initialGroupPortions
            const initialGroupPortions = parseFormulaToInitialPortions(formula);
            res.json(initialGroupPortions);
        } else {
            res.status(404).send('Diet plan not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Функция для анализа формулы и получения начальных значений порций
function parseFormulaToInitialPortions(formula) {
    const initialPortions = {};
    const matches = formula.match(/([А-Я][0-9]+)/g);
    matches.forEach(match => {
        const group = match.slice(0, 1);
        const number = parseInt(match.slice(1), 10);
        initialPortions[group] = number;
    });
    return initialPortions;
}

// Эндпоинт для получения приемов пищи по дате и типу
// Эндпоинт для получения приемов пищи по дате и типу
// Эндпоинт для получения приемов пищи по идентификатору плана диеты, дате и типу
app.get('/diet-plan/:dietPlanId/meals/:mealDate/:mealType', async (req, res) => {
    const { dietPlanId, mealDate, mealType } = req.params;
    console.log(`Requested dietPlanId: ${dietPlanId}, mealDate: ${mealDate}, mealType: ${mealType}`);

    // Проверка на правильность входных данных для dietPlanId и mealDate
    if (!Number.isInteger(parseInt(dietPlanId)) || isNaN(Date.parse(mealDate))) {
        return res.status(400).send('Invalid dietPlanId or date format');
    }
    
    let query, params;

    if (mealType === 'all') {
      // Если запрашиваются все типы приемов пищи для данного diet_plan_id и даты
      query = 'SELECT * FROM selected_products WHERE diet_plan_id = $1 AND meal_date = $2';
      params = [dietPlanId, mealDate];
    } else {
      // Если запрашивается конкретный тип приема пищи для данного diet_plan_id и даты
      query = 'SELECT * FROM selected_products WHERE diet_plan_id = $1 AND meal_date = $2 AND meal_type = $3';
      params = [dietPlanId, mealDate, mealType];
    }
    
    try {
      const result = await pool.query(query, params);
      if (result.rows.length > 0) {
        res.json(result.rows);
      } else {
        res.status(404).send('No meals found for the given criteria');
      }
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
});



  

app.post('/save-ration', async (req, res) => {
    const { user_id, products } = req.body;

    try {
        const dietPlanResult = await pool.query(
            'SELECT diet_id FROM diet_plan WHERE user_id = $1',
            [user_id]
        );

        if (dietPlanResult.rows.length === 0) {
            return res.status(400).json({ message: 'Diet plan does not exist.' });
        }

        const diet_plan_id = dietPlanResult.rows[0].diet_id;

        for (const product of products) {
            const { product_id, quantity, meal_type, meal_date } = product;

            const existsResult = await pool.query(
                'SELECT * FROM selected_products WHERE diet_plan_id = $1 AND product_id = $2',
                [diet_plan_id, product_id]
            );

            if (existsResult.rows.length > 0) {
                // Обновляем существующую запись
                await pool.query(
                    'UPDATE selected_products SET quantity = $1, meal_type = $2, meal_date = $3 WHERE diet_plan_id = $4 AND product_id = $5',
                    [quantity, meal_type, meal_date, diet_plan_id, product_id]
                );
            } else {
                // Вставляем новую запись
                await pool.query(
                    'INSERT INTO selected_products (diet_plan_id, product_id, quantity, meal_type, meal_date) VALUES ($1, $2, $3, $4, $5)',
                    [diet_plan_id, product_id, quantity, meal_type, meal_date]
                );
            }
        }

        res.json({ message: 'Selected products updated successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});


  
  


  app.delete('/remove-product', async (req, res) => {
    const { user_id, product_id } = req.body;

    try {
        await pool.query('DELETE FROM selected_products WHERE diet_plan_id = $1 AND product_id = $2', [user_id, product_id]);
        res.send('Product removed successfully');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.get('/product-mass/:productId', async (req, res) => {
    const { productId } = req.params;

    try {
        const result = await pool.query('SELECT mass FROM products WHERE product_id = $1', [productId]);
        if (result.rows.length > 0) {
            res.json({ mass: result.rows[0].mass });
        } else {
            res.status(404).send('Product not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.get('/product-group/:productId', async (req, res) => {
    const { productId } = req.params;
    console.log(productId)
    try {
        const result = await pool.query('SELECT macro FROM products WHERE product_id = $1', [productId]);
        if (result.rows.length > 0) {
            res.json({ group: result.rows[0].macro });
        } else {
            res.status(404).send('Product not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});



  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
// module.exports = app;
