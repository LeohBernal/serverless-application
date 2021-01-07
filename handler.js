const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000"
};

const isOffline = () => process.env.IS_OFFLINE;

const dynamoDB = isOffline() ? 
  new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions) 
  : new AWS.DynamoDB.DocumentClient();

const params = {
  TableName: process.env.PACIENTES_TABLE,
};

module.exports.listarPacientes = async (event) => {
  // MySQL
  // SELECT * FROM table LIMIT 10 OFFSET 21
  // DynamoDB
  // Limit = LIMIT, ExclusiveStartKey = OFFSET e LastEvaluatedKey = "Numero da Pagina"

  try {
    const queryString = {
      limit: 5,
      ...event.queryStringParameters
    }
    
    const { limit, next } = queryString
    
    let localParams = {
      ...params,
      Limit: limit
    }
    
    if (next) {
      localParams.ExclusiveStartKey = {
        paciente_id: next
      }
    }
    
    let data = await dynamoDB.scan(localParams).promise();
    
    let nextToken = data.LastEvaluatedKey != undefined
      ? data.LastEvaluatedKey.paciente_id 
      : null;
    
    const result = {
      items: data.Items,
      next_token: nextToken
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.log("Error", err);
    return {
      statusCode: err.statusCode ? err.statusCode : 500,
      body: JSON.stringify({
        error: err.name ? err.name : "Exception",
        message: err.message ? err.message : "Unknown error",
      }),
    };
  }
};

module.exports.obterPaciente = async (event) => {
  try {

    const { pacienteId } = event.pathParameters;

    const data = await dynamoDB
      .get({
        ...params,
        Key: {
          paciente_id: pacienteId
        }
      })
      .promise();

    const paciente = data.Item;

    if(!paciente) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Paciente não existe" }, null, 2)
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify(paciente, null, 2),
    };

  } catch (err) {
    console.log("Error", err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({
        error: err.name || "Exception",
        message: err.message || "Unknown error",
      }),
    };
  }
}

module.exports.cadastrarPaciente = async (event) => {
  try {

    const dados = JSON.parse(event.body);

    const timestamp = new Date().getTime();

    const {
      nome, data_nascimento, email, telefone
    } = dados;

    const paciente = { 
      paciente_id: uuidv4(), 
      nome, 
      data_nascimento, 
      email, 
      telefone,
      status: true,
      criado_em: timestamp,
      atualizado_em: timestamp,
     };

    const data = await dynamoDB
      .put({
        ...params,
        Item: paciente,
      })
      .promise();

    return {
      statusCode: 201,
    };

  } catch (err) {
    console.log("Error", err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({
        error: err.name || "Exception",
        message: err.message || "Unknown error",
      }),
    };
  }
}

module.exports.atualizarPaciente = async (event) => {
  const { pacienteId } = event.pathParameters;

  try {

    const dados = JSON.parse(event.body);

    const timestamp = new Date().getTime();

    const {
      nome, data_nascimento, email, telefone
    } = dados;

    const data = await dynamoDB
      .update({
        ...params,
        Key: {
          paciente_id: pacienteId
        },
        UpdateExpression:
        'SET nome = :nome, data_nascimento = :dt, email = :email,'
        + ' telefone = :telefone, atualizado_em = :atualizado_em',
        ConditionExpression: 'attribute_exists(paciente_id)',
        ExpressionAttributeValues: {
          ':nome': nome,
          ':dt': data_nascimento,
          ':email': email,
          ':telefone': telefone,
          ':atualizado_em': timestamp
        }
      })
      .promise();

    return {
      statusCode: 204,
    };

  } catch (err) {
    
    console.log("Error", err);
    
    let error = err.name || 'Exception';
    let message = err.message || 'Unknown error';
    let statusCode = err.statusCode || 500;

    if(error === 'ConditionalCheckFailedException') {
      error = 'Paciente não existe';
      message = `Recurso com o ID ${pacienteId} não existe e não pode ser atualizado`;
      statusCode = 404;
    }

    return {
      statusCode: statusCode,
      body: JSON.stringify({
        error,
        message,
      })
    };
  }
}

module.exports.excluirPaciente = async (event) => {
  const { pacienteId } = event.pathParameters;

  try {

    await dynamoDB
      .delete({
        ...params,
        Key: {
          paciente_id: pacienteId
        },
        ConditionExpression: 'attribute_exists(paciente_id)',
      })
      .promise();

    return {
      statusCode: 204,
    };

  } catch (err) {
    console.log("Error", err);
    
    let error = err.name || 'Exception';
    let message = err.message || 'Unknown error';
    let statusCode = err.statusCode || 500;

    if(error === 'ConditionalCheckFailedException') {
      error = 'Paciente não existe';
      message = `Recurso com o ID ${pacienteId} não existe e não pode ser deletado`;
      statusCode = 404;
    }

    return {
      statusCode: statusCode,
      body: JSON.stringify({
        error,
        message,
      })
    };
  }
}