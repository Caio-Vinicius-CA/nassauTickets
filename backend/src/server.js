require('dotenv').config();

const app = require('./app');
const { prepararBanco } = require('./services/seedService');

const port = Number(process.env.PORT) || 3000;

prepararBanco()
  .then(() => {
    app.listen(port, () => {
      console.log(`nassauTickets API ouvindo na porta ${port}`);
    });
  })
  .catch((err) => {
    console.error('Não foi possível iniciar a API:', err.message);
    process.exit(1);
  });
