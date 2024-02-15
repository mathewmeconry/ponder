import { Context, ponder } from "@/generated";

ponder.on("Equity:Trade", async ({ event, context }) => {
  const { Trade } = context.db;

  await Trade.create({
    id: event.args.who + "_" + event.block.timestamp.toString(),
    data: {
      trader: event.args.who,
      amount: event.args.totPrice,
      shares: event.args.amount,
      price: event.args.newprice,
      time: event.block.timestamp,
    },
  });
});

ponder.on("Equity:Delegation", async ({ event, context }) => {
  const addParentDelegation = async (
    delegatedFrom: string | undefined,
    arrayToAdd: string[]
  ) => {
    if (!delegatedFrom) return;

    const parentDelegation = await Delegation.upsert({
      id: delegatedFrom,
      create: {
        owner: delegatedFrom,
        pureDelegatedFrom: arrayToAdd,
      },
      update: ({ current }) => ({
        pureDelegatedFrom: current.pureDelegatedFrom.concat(
          arrayToAdd.filter(
            (item) => current.pureDelegatedFrom.indexOf(item) < 0
          )
        ),
      }),
    });

    addParentDelegation(parentDelegation.delegatedTo, arrayToAdd);
  };

  const removeParentDelegation = async (
    delegationTo: string | undefined,
    arrayToRemove: string[]
  ) => {
    if (!delegationTo) return;

    const parentDelegation = await Delegation.findUnique({ id: delegationTo });
    if (parentDelegation) {
      const pureDelegatedFrom: string[] = [];
      for (const delegatedFrom of parentDelegation.pureDelegatedFrom) {
        if (!arrayToRemove.includes(delegatedFrom))
          pureDelegatedFrom.push(delegatedFrom);
      }

      await Delegation.update({
        id: delegationTo,
        data: {
          pureDelegatedFrom,
        },
      });

      removeParentDelegation(parentDelegation.delegatedTo, arrayToRemove);
    }
  };

  const { Delegation } = context.db;
  const delegation = await Delegation.upsert({
    id: event.args.from,
    create: {
      owner: event.args.from,
      pureDelegatedFrom: [],
    },
    update: {},
  });

  const arrayToUpdate = [event.args.from];
  removeParentDelegation(delegation.delegatedTo, arrayToUpdate);

  await Delegation.update({
    id: event.args.from,
    data: {
      delegatedTo: event.args.to,
    },
  });

  addParentDelegation(event.args.to, arrayToUpdate);
});