import React, { useState, useEffect } from "react";
import apis from "../api/apis";
import format from "date-fns/format";
import { Button, Modal, Grid, Icon, Feed, Segment } from "semantic-ui-react";
import _ from "lodash";

const Order = () => {
  const [orders, setOrders] = useState([]);
  const [modal, setModal] = useState(false);
  const [currentOrder, setCurrentOrder] = useState();

  useEffect(() => {
    apis.get.orders({ paid: false }).then((res) => {
      const unpaidOrders = res.data;
      if (unpaidOrders.length) {
        addToCurrentTable(unpaidOrders);
      } else {
        setNewTable();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addToCurrentTable = (orders) => {
    apis.get
      .order_item({ sent_to_order: true, paid: false, added_to_order: false })
      .then((res) => {
        const orderItems = res.data;
        const tableNames = orders.map(
          (orderInfo) => orderInfo.table.table_name
        );
        const tName = tableNames.find((tableName) => {
          const eq = orderItems.find((orderItem) => {
            return orderItem.table.table_name === tableName;
          });

          return eq;
        });
        if (!tName) {
          addTables(orderItems);
        }

        orders.forEach((orderInfo) => {
          if (
            !orderItems.length ||
            !orderItems.find(
              (item) => item.table.table_name === orderInfo.table.table_name
            )
          ) {
            return setOrders((prevState) => [...prevState, orderInfo]);
          }

          if (
            orderItems.find(
              (item) => item.table.table_name === orderInfo.table.table_name
            )
          ) {
            const newOrderItems = [];
            orderItems.forEach((orderItem) => {
              if (orderItem.table.table_name === orderInfo.table.table_name) {
                newOrderItems.push(orderItem);
              }
            });

            const oldOrderItems = [...orderInfo.order_items];
            oldOrderItems.forEach((oldItem) => {
              newOrderItems.push(oldItem);
            });
            const order_item_ids = newOrderItems.map((x) => x.id);
            order_item_ids.forEach((itemId) => {
              apis.put
                .order_item({ added_to_order: true }, itemId)
                .then((res) => {
                  // console.log(
                  //   "added to current table, sent to order true",
                  //   res.data
                  // );
                });
            });
            apis.put
              .orders({ order_items: order_item_ids }, orderInfo.id)
              .then((res) => {
                apis.get
                  .order(res.data.id)
                  .then((res) => {
                    setOrders((prevState) => {
                      const orders = [...prevState];
                      const updatedOrders = orders.filter(
                        (order) => order.id !== res.data.id
                      );
                      updatedOrders.push(res.data);
                      return updatedOrders;
                    });
                  })
                  .then((res) => {
                    setNewTable();
                  });
              });
          }
        });
      });
  };

  const setNewTable = () => {
    apis.get
      .order_item({
        sent_to_order: true,
        paid: false,
        added_to_order: false,
      })
      .then((res) => {
        addTables(res.data);
      });
  };

  const addTables = (orderItems) => {
    if (!orderItems.length) {
      return;
    }
    const orderItemsObj = orderItems.reduce((obj, item) => {
      if (!obj[item.table.id]) {
        obj[item.table.id] = [item];
      } else {
        obj[item.table.id].push(item);
      }
      return obj;
    }, {});

    const orderByNameAndIds = _.keys(orderItemsObj).map((tableId) => {
      const orderItemIds = orderItemsObj[tableId].reduce((a, c) => {
        a.push(c.id);
        return a;
      }, []);

      return { tableId, order_item_ids: orderItemIds };
    });
    orderByNameAndIds.forEach((item) => {
      const { tableId, order_item_ids } = item;

      const data = {
        completed: true,
        order_items: order_item_ids,
        table: tableId,
      };

      apis.post.orders(data).then((res) => {
        order_item_ids.forEach((order_item_id) => {
          apis.put
            .order_item({ added_to_order: true }, order_item_id)
            .then((res) => {
              // console.log("add tables", res.data);
            });
        });
        apis.get.order(res.data.id).then((res2) => {
          const orders = res2.data;
          setOrders((prevState) => [...prevState, orders]);
        });
      });
    });
  };

  const getOrderProfit = (order) => {
    return order.order_items.reduce((totalAll, item) => {
      return (totalAll += item.product.price * item.quantity);
    }, 0);
  };

  const completeOrder = () => {
    apis.put
      .orders({ paid: true, paid_time: new Date() }, currentOrder.id)
      .then((_) => {
        setOrders((prevState) => {
          const state = [...prevState];
          const updatedState = state.filter((state) => {
            return state.id !== currentOrder.id;
          });
          return updatedState;
        });
      });
    setModal(false);
  };

  const payForIndividualItem = (orderItem, orderId) => {
    const orderItemId = orderItem.id;
    apis.put.order_item({ paid: true }, orderItemId).then((_) => {
      setOrders((prevState) => {
        const state = [...prevState];
        const order = state.filter((orderState) => orderState.id === orderId);
        const filteredOrders = state.filter(
          (orderState) => orderState.id !== orderId
        );

        const filteredOrderItems = order[0].order_items;
        filteredOrderItems.forEach((item) => {
          if (item.id === orderItemId) {
            item.paid = true;
          }
        });
        order[0].order_items = filteredOrderItems;
        return [...order, ...filteredOrders];
      });
    });
  };

  return (
    <Grid textAlign="center">
      <Grid.Column style={{ maxWidth: 450 }}>
        {!orders.length && <span className="mx-2">????????????...</span>}
        {orders.length > 0 &&
          orders.map((order) => (
            <Segment key={order.id}>
              <Feed>
                <Feed.Event>
                  <Feed.Content>
                    <Feed.Summary>
                      {`?????????${order.table?.table_name}`}
                      <Feed.Date>{`???????????????${format(
                        new Date(order.published_at),
                        "yyyy-MM-dd HH:mm"
                      )}`}</Feed.Date>
                    </Feed.Summary>
                    <Feed.Extra text>
                      {order.order_items.map((item) => (
                        <div
                          style={
                            item.paid ? { textDecoration: "line-through" } : {}
                          }
                          key={item.id}
                        >
                          <span>- {item.product?.product_name}</span>
                          {"    "}
                          <span
                            style={{ fontWeight: "bolder" }}
                          >{`${item.quantity}   `}</span>
                          <span>???</span>
                          {item.paid === false && (
                            <Button
                              className="mx-4"
                              color="teal"
                              onClick={() =>
                                payForIndividualItem(item, order.id)
                              }
                            >{`??????$${item.product.price}`}</Button>
                          )}
                          <div style={{ clear: "both" }} />
                          <br />
                        </div>
                      ))}
                    </Feed.Extra>
                    <Feed.Meta>
                      <Feed.Like
                        style={{
                          fontWeight: "bolder",
                          color: "black",
                          fontSize: 20,
                        }}
                      >
                        <Icon name="dollar" />
                        {getOrderProfit(order)} {"  "}?????????
                      </Feed.Like>
                      <div style={{ display: "inline-block", marginLeft: 170 }}>
                        <Button
                          color="red"
                          onClick={() => {
                            setModal(true);
                            setCurrentOrder(order);
                          }}
                        >
                          ????????????
                        </Button>
                      </div>
                    </Feed.Meta>
                  </Feed.Content>
                </Feed.Event>
              </Feed>
            </Segment>
          ))}
        <Modal
          basic
          onClose={() => setModal(false)}
          onOpen={() => setModal(true)}
          open={modal}
          size="small"
          centered
        >
          <Modal.Content>
            <p>???????????????</p>
          </Modal.Content>
          <Modal.Actions>
            <Button basic color="red" inverted onClick={() => setModal(false)}>
              <Icon name="remove" /> No
            </Button>
            <Button
              color="green"
              inverted
              onClick={() => {
                completeOrder();
              }}
            >
              <Icon name="checkmark" /> Yes
            </Button>
          </Modal.Actions>
        </Modal>
      </Grid.Column>
    </Grid>
  );
};

export default Order;
